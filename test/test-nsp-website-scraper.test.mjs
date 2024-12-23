import { expect } from 'chai'
import nock from 'nock'
import constants from '../lib/constants.mjs'
import { getNSPVersion, NSPFile, NSPVersion } from '../lib/vline-nsp.mjs'

import { dir as tmpdir } from 'tmp-promise'

import fs from 'fs/promises'
import path from 'path'
import url from 'url'

const __filename = url.fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const nspFP61FP62 = (await fs.readFile(path.join(__dirname, 'sample-data', 'nsp-fp61-fp62.html'))).toString()
const nspFP63 = (await fs.readFile(path.join(__dirname, 'sample-data', 'nsp-fp63.html'))).toString()
const nspFP63EasternFreight = await fs.readFile(path.join(__dirname, 'sample-data', 'FP63 15-09-24 Eastern and S-East Freight NSP190824.pdf'))

describe('The NSP website scraper', () => {
  
  describe('The getNSPVersion function', () => {
    it('Should read the NSP website and determine the NSP version available', async () => {
      nock(constants.VLINE_CORPORATE_HOST).get(constants.NSP_PAGE).reply(200, nspFP63)
      
      let version = await getNSPVersion()
      expect(version.length).to.equal(1)
      expect(version[0].version).to.equal('FP63')
      expect(version[0].effective).to.deep.equal(new Date('2024-09-15'))
    })

    it('Should work with multiple NSP version being available', async () => {
      nock(constants.VLINE_CORPORATE_HOST).get(constants.NSP_PAGE).reply(200, nspFP61FP62)

      let version = await getNSPVersion()
      expect(version.length).to.equal(2)
      expect(version[0].version).to.equal('FP62')
      expect(version[0].effective).to.deep.equal(new Date('2023-11-19'))

      expect(version[1].version).to.equal('FP61')
      expect(version[1].effective).to.deep.equal(new Date('2023-05-28'))
    })

    it('Should return the timetables as a list of NSP files', async () => {
      nock(constants.VLINE_CORPORATE_HOST).get(constants.NSP_PAGE).reply(200, nspFP63)
      
      let version = await getNSPVersion()
      expect(version[0].files[0].name).to.equal('Central Freight')
      expect(version[0].files[0].href).to.contain('/CMSPages/GetSharePointFile.ashx?connectionname=Network-Service-Plan')

      expect(version[0].files[1].name).to.equal('Eastern and S-East Freight')
    })
  })

})

describe('The NSPVersion class', () => {
  it('Should download its files to a given output directory', async () => {
    let tmp = await tmpdir({ unsafeCleanup: true })

    nock(constants.VLINE_CORPORATE_HOST).get('/file.pdf').reply(200, nspFP63EasternFreight)

    let nspVersion = new NSPVersion('FP99', new Date('2024-01-02'))
    nspVersion.addFile(new NSPFile('Eastern and S-East Freight', '/file.pdf', nspVersion))

    await nspVersion.saveFiles(tmp.path)

    let stat = await fs.stat(path.join(tmp.path, 'FP99 Eastern and S-East Freight.pdf'))
    expect(stat.size).to.equal(27750)

    await tmp.cleanup()
  })
})