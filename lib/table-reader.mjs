import PDFParser from 'pdf2json'
import fs from 'fs/promises'

export default class TableReader {

  #file

  constructor(file) {
    this.#file = file
  }

  parserCallback(data) {
    // PDF's contain pages and each page contains Texts. These texts have an x and y value.
    // So finding Texts with equal y values seems like the solution.
    // However, some y values are off by 0.010 pixels/points so let's first find what the smallest y value could be.

    // Let's find Texts with the same x value and look for the smallest y distance of these Texts (on the same page of course)
    // Then use those smallest y values (per page) to find Texts that seem to be on the same row
    // If no smallest y value (per page) can be found, use 0 as smallest distance.


    // now lets find Texts with 'the same' y-values, Actually y-values in the range of y-smallestYValue and y+smallestYValue:

    let pages = data.Pages.slice(0).map(page => {
      let fills = page.Fills
      let verticalFills = fills.filter(fill => {
        return fill.h > fill.w
      })
      let horizontalFills = fills.filter(fill => {
        return fill.h < fill.w
      })

      let colStarts = verticalFills.map(fill => fill.x).filter((e, i, a) => a.indexOf(e) === i).sort((a, b) => a - b)
      let rowStarts = horizontalFills.map(fill => fill.y).filter((e, i, a) => a.indexOf(e) === i).sort((a, b) => a - b)

      let rows = [] // store Texts and their x positions in rows

      for (let t = 0; t < page.Texts.length; t++) {
        let text = page.Texts[t]
        let textContent = decodeURIComponent(text.R[0].T)

        let firstYGreater = rowStarts.find(r => r > text.y + 0.1)
        let difference = firstYGreater - text.y
        let currentRow = rowStarts.indexOf(firstYGreater) - 1
        if (difference > 0.6) currentRow--

        if (currentRow < 0) continue
          // y value of Text falls within the y-value range, add text to row:

        if (!['EMPTY', 'LIGHT_LO', 'PSNG_SRV', 'QL', 'PN', 'SSR', 'Train Movement Type'].includes(textContent) && currentRow === 4)
          currentRow = 3

        let currentCol = colStarts.findIndex(c => c > text.x + 0.3) - 1

        if (!rows[currentRow]) {
          // create new row:
          rows[currentRow] = {
            y: text.y,
            data: []
          }
        }

        if (!rows[currentRow].data[currentCol]) {
          rows[currentRow].data[currentCol] = {
            text: textContent,
            x: text.x
          }
        } else {
          rows[currentRow].data[currentCol].text += ` ${textContent}`
        }
      }

      // rows = rows.filter(Boolean)
      for (var i = 0; i < rows.length; i++) {
        if (!rows[i]) rows[i] = {y:0,data:[]}
        for (let j = 0; j < rows[i].data.length; j++) {
          if (!rows[i].data[j]) {
            rows[i].data[j] = {text: '', x: 0}
          }
        }
      }
      return rows
    })

    return pages.map(page => {
      let maxSize = Math.max(...page.map(row => row.data.length))
      let blankCells = Array(maxSize).fill('')

      return page.map(row => row.data.map(g => g.text).concat(blankCells).slice(0, maxSize))
    })
  }

  read() {
    return new Promise(async (resolve, reject) => {
      let pdfParser = new PDFParser()

      // adding try/catch/printstack 'cause pdfParser seems to prevent errors from bubbing up (weird implementation).
      // It also doesn't seem to implement the callback(err, otherdata) convention used in most Node.js modules, so let's fix that here.
      pdfParser.on("pdfParser_dataReady", data => {
        try {
          resolve(this.parserCallback(data))
        } catch (err) {
          console.log(err.stack)
        }
      })
    
      pdfParser.on("pdfParser_dataError", err => {
        reject(err)
      })

      let pdfBuffer = await fs.readFile(this.#file)
      pdfParser.parseBuffer(pdfBuffer)
    })
  
  }

}