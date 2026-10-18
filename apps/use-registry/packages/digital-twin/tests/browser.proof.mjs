// Actual package UI and Rust WASM under Studio's CSP; resources are an explicit test owner.
import assert from 'node:assert/strict'
import { mkdir } from 'node:fs/promises'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { playwright, serveView } from '../../g1-arm/tests/view-host.mjs'
import * as THREE from '../../g1-arm/ui/workbench/vendor/three/three.module.min.js'
import { createScene } from '../src/domain.mjs'

const viewRoot = fileURLToPath(new URL('..', import.meta.url))
const { server, origin } = await serveView({
  token: 'a'.repeat(64),
  documentId: 'b'.repeat(64),
  width: 1440,
  height: 900,
  viewRoot,
  entry: 'ui/editor/index.html'
})
const workspaceId = '88c13a16-6d21-4eae-a783-7118d5d00f8b'
const projectId = 'a8bdc964-0557-469a-a879-e252e09dc28f'

async function prove(engine, launch) {
  const browser = await launch()
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })
    await page.addInitScript(() => {
      window.homeReceipts = []
      window.addEventListener('message', (event) => {
        if (event.data?.type !== 'aix.document.ready' || event.ports.length !== 1) return
        const port = event.ports[0]
        window.sendHomeSeed = (delivery, seed) => port.postMessage({ protocolVersion: 1, type: 'aix.view.seed', delivery, seed })
        port.addEventListener('message', ({ data }) => {
          if (data.type === 'aix.view.home') window.homeReceipts.push(data)
        })
      })
    })
    const problems = []
    page.on('pageerror', (error) => problems.push(String(error)))
    page.on('console', (message) => {
      if (message.type() === 'error') problems.push(message.text())
    })
    let stored = { key: 'scene', revision: 1, content: createScene('fixture-scene').content }
    const receipts = new Map()
    const documents = new Map([[projectId, stored]])
    const leases = new Map()
    let draft = { revision: 0, content: null }
    const draftReceipts = new Map()
    const projectList = [{ id: projectId, title: '测试项目' }]
    let loseCreateReply = true
    let loseReply = false
    let conflict = false
    let effects = 0
    await page.exposeFunction('resource', async (request) => {
      switch (request.operation) {
        case 'read-draft':
          return { value: draft }
        case 'save-draft': {
          if (draftReceipts.has(request.operationId)) return { value: draftReceipts.get(request.operationId) }
          if (request.expectedRevision !== draft.revision) return { reason: 'conflict' }
          draft = { revision: draft.revision + 1, content: request.content }
          draftReceipts.set(request.operationId, draft)
          return { value: draft }
        }
        case 'workspaces':
          return { value: [{ id: workspaceId, name: '测试工作区' }] }
        case 'projects':
          return {
            value: { items: projectList, total: projectList.length, page: 1, limit: 20 }
          }
        case 'create-project': {
          let project = projectList.find((item) => item.id === request.id)
          if (project && project.title !== request.title) return { reason: 'conflict' }
          if (!project) {
            project = { id: request.id, title: request.title }
            projectList.push(project)
          }
          if (loseCreateReply) {
            loseCreateReply = false
            return { reason: 'outcome_unknown' }
          }
          return { value: project }
        }
        case 'open': {
          const lease = crypto.randomUUID()
          leases.set(lease, request.projectId)
          return { value: { lease } }
        }
        case 'close':
          leases.delete(request.lease)
          return { value: null }
        case 'read': {
          const value = documents.get(leases.get(request.lease))
          return value ? { value } : { reason: 'not_found' }
        }
        case 'read-receipt':
          return receipts.has(request.operationId)
            ? { value: receipts.get(request.operationId) }
            : { reason: 'not_found' }
        case 'save': {
          if (receipts.has(request.operationId)) return { value: receipts.get(request.operationId) }
          const id = leases.get(request.lease)
          if (!id) return { reason: 'not_found' }
          const previous = documents.get(id)
          if (conflict || request.expectedRevision !== (previous?.revision ?? null)) return { reason: 'conflict' }
          effects += 1
          const next = { key: 'scene', revision: (previous?.revision ?? 0) + 1, content: request.content }
          documents.set(id, next)
          if (id === projectId) stored = next
          const receipt = { operationId: request.operationId, document: next }
          receipts.set(request.operationId, receipt)
          if (loseReply) {
            loseReply = false
            return { reason: 'outcome_unknown' }
          }
          return { value: receipt }
        }
        default:
          return { reason: 'invalid_request' }
      }
    })
    await page.goto(`${origin}/host.html`)
    const frame = page.frameLocator('#view')
    await frame.getByRole('heading', { name: '数字孪生编辑器', exact: true }).waitFor()
    await page.evaluate(() => window.sendHomeSeed(1, { content: '构建仓储数字孪生场景' }))
    await playwright.expect(frame.getByRole('textbox', { name: '场景需求', exact: true })).toHaveValue('构建仓储数字孪生场景')
    await playwright.expect(frame.getByText('已接收需求。预览版尚未开放 AI 场景生成，请使用编辑工具构建场景。')).toBeVisible()
    await page.waitForFunction(() => window.homeReceipts.some((receipt) => receipt.delivery === 1 && receipt.applied === true))
    await page.evaluate(() => window.sendHomeSeed(2, { content: '不得覆盖已有需求' }))
    await page.waitForFunction(() => window.homeReceipts.some((receipt) => receipt.delivery === 2 && receipt.applied === false && receipt.holdsWork === true))
    await playwright.expect(frame.getByRole('textbox', { name: '场景需求', exact: true })).toHaveValue('构建仓储数字孪生场景')
    await frame.getByRole('button', { name: '清除场景需求', exact: true }).click()
    await playwright.expect(frame.getByRole('textbox', { name: '场景需求', exact: true })).toHaveCount(0)
    await frame.getByRole('combobox', { name: '工作区', exact: true }).click()
    await frame.getByRole('option', { name: '测试工作区', exact: true }).click()
    await frame.getByRole('combobox', { name: '项目', exact: true }).click()
    await frame.getByRole('option', { name: '测试项目', exact: true }).click()
    await playwright.expect(frame.getByRole('status')).toContainText('已保存')
    await frame.getByRole('button', { name: '添加方体', exact: true }).click()
    await page.evaluate(() => window.sendHomeSeed(3, { content: '不得覆盖未保存场景' }))
    await page.waitForFunction(() => window.homeReceipts.some((receipt) => receipt.delivery === 3 && receipt.applied === false && receipt.holdsWork === true))
    await playwright.expect(frame.getByRole('textbox', { name: '场景需求', exact: true })).toHaveCount(0)
    await frame.getByLabel('位置（m） X', { exact: true }).fill('2.75')
    await frame.getByLabel('名称', { exact: true }).fill('测试方体')
    await frame
      .getByLabel('名称', { exact: true })
      .dispatchEvent('keydown', { key: 'Enter', bubbles: true, isComposing: true })
    await playwright
      .expect(frame.getByRole('navigation', { name: '场景物体' }).getByRole('button', { name: '方体 1', exact: true }))
      .toHaveCount(1)
    await frame.getByLabel('名称', { exact: true }).press('Enter')
    await playwright
      .expect(
        frame.getByRole('navigation', { name: '场景物体' }).getByRole('button', { name: '测试方体', exact: true })
      )
      .toHaveAttribute('aria-current', 'true')
    await frame.getByRole('button', { name: '撤销', exact: true }).click()
    await playwright.expect(frame.getByLabel('位置（m） X', { exact: true })).toHaveValue('0')
    await frame.getByRole('button', { name: '重做', exact: true }).click()
    await playwright.expect(frame.getByLabel('位置（m） X', { exact: true })).toHaveValue('2.75')

    await frame.getByLabel('缩放 X', { exact: true }).fill('-1')
    await frame.getByRole('button', { name: '应用属性', exact: true }).click()
    await playwright.expect(frame.getByRole('alert')).toContainText('正比例缩放')
    await playwright.expect(frame.getByRole('alert')).toBeFocused()
    await frame.getByRole('alert').getByRole('link', { name: '缩放 X', exact: true }).click()
    await playwright.expect(frame.getByLabel('缩放 X', { exact: true })).toBeFocused()
    await frame.getByRole('button', { name: '读取当前属性', exact: true }).click()

    loseReply = true
    await frame.getByRole('button', { name: '保存场景', exact: true }).click()
    await playwright.expect(frame.getByRole('alert')).toContainText('写入结果尚未确认')
    await frame.getByRole('button', { name: '添加球体', exact: true }).click()
    await frame.getByRole('button', { name: '重试同一次保存', exact: true }).click()
    await playwright.expect(frame.getByRole('status')).toContainText('尚未保存')
    assert.equal(effects, 1, `${engine}: retry duplicated the write`)
    assert.ok(!stored.content.includes('球体'), `${engine}: retry changed the submitted snapshot`)
    await frame.getByRole('button', { name: '保存场景', exact: true }).click()
    await playwright.expect(frame.getByRole('status')).toContainText('已保存')
    assert.equal(effects, 2)
    assert.ok(stored.content.includes('球体'))

    conflict = true
    await frame.getByLabel('名称', { exact: true }).fill('冲突草稿')
    await frame.getByRole('button', { name: '保存场景', exact: true }).click()
    await playwright.expect(frame.getByRole('alert')).toContainText('草稿已保留')
    await playwright.expect(frame.getByLabel('名称', { exact: true })).toHaveValue('冲突草稿')
    await frame.getByRole('button', { name: '读取已保存场景', exact: true }).first().click()
    await frame.getByRole('button', { name: '取消', exact: true }).click()
    await playwright.expect(frame.getByLabel('名称', { exact: true })).toHaveValue('冲突草稿')
    conflict = false
    await frame.getByRole('button', { name: '读取已保存场景', exact: true }).first().click()
    await frame.getByRole('button', { name: '放弃修改', exact: true }).click()
    await playwright.expect(frame.getByRole('status')).toContainText('已保存')
    await playwright
      .expect(
        frame.getByRole('navigation', { name: '场景物体' }).getByRole('button', { name: '冲突草稿', exact: true })
      )
      .toHaveCount(0)

    const document = page.frames().find((candidate) => candidate.url().includes('/ui/editor/index.html'))
    const viewport = await frame.locator('.twin-viewport').boundingBox()
    const screenshot = await frame.locator('.twin-viewport').screenshot()
    assert.ok(viewport.width > 500 && viewport.height > 400, `${engine}: viewport collapsed`)
    assert.ok(screenshot.length > 12_000, `${engine}: viewport looks blank`)
    const fonts = await document.evaluate(() =>
      document.fonts.ready.then(() => document.fonts.check('400 13px Ubuntu'))
    )
    assert.equal(fonts, true, `${engine}: bundled font failed`)
    // Project the known sphere center, then use real pointer input to select it.
    const camera = new THREE.PerspectiveCamera(45, viewport.width / viewport.height, 0.01, 1000)
    camera.up.set(0, 0, 1)
    camera.position.set(6, -8, 5)
    camera.lookAt(0, 0, 0.5)
    camera.updateMatrixWorld()
    const projectPoint = (point) => {
      const value = new THREE.Vector3(...point).project(camera)
      return {
        x: viewport.x + ((value.x + 1) * viewport.width) / 2,
        y: viewport.y + ((1 - value.y) * viewport.height) / 2
      }
    }
    const center = projectPoint([0, 0, 0.5])
    await page.mouse.click(center.x, center.y)
    await playwright.expect(frame.getByLabel('名称', { exact: true })).toHaveValue('球体 2')
    const scale = (camera.position.distanceTo(new THREE.Vector3(0, 0, 0.5)) * 1.9 * Math.tan((Math.PI * 45) / 360)) / 4
    const handle = projectPoint([scale * 0.45, 0, 0.5])
    await page.mouse.move(handle.x, handle.y)
    await page.mouse.down()
    await page.mouse.move(handle.x + 45, handle.y, { steps: 8 })
    await page.mouse.up()
    await playwright.expect(frame.getByLabel('位置（m） X', { exact: true })).not.toHaveValue('0')
    await frame.getByRole('button', { name: '撤销', exact: true }).click()
    await playwright.expect(frame.getByLabel('位置（m） X', { exact: true })).toHaveValue('0')
    await playwright.expect(frame.getByRole('button', { name: '撤销', exact: true })).toBeDisabled()
    // One drag is one history entry; Escape must add none.
    await page.mouse.move(handle.x, handle.y)
    await page.mouse.down()
    await page.mouse.move(handle.x + 30, handle.y, { steps: 6 })
    await page.keyboard.press('Escape')
    await page.mouse.up()
    await playwright.expect(frame.getByRole('button', { name: '撤销', exact: true })).toBeDisabled()
    await playwright.expect(frame.getByLabel('位置（m） X', { exact: true })).toHaveValue('0')
    if (process.env.PROOF_SCREENSHOTS) {
      await mkdir(process.env.PROOF_SCREENSHOTS, { recursive: true })
      await page.screenshot({ path: join(process.env.PROOF_SCREENSHOTS, `${engine}-editor.png`) })
    }
    assert.deepEqual(problems, [], `${engine}: browser errors`)
    await page.locator('#view').evaluate((iframe) => {
      iframe.style.width = '390px'
      iframe.style.height = '844px'
    })
    await frame.getByRole('button', { name: '属性', exact: true }).click()
    await playwright.expect(frame.getByLabel('名称', { exact: true })).toBeVisible()
    await frame.getByRole('button', { name: '关闭面板', exact: true }).click()
    await playwright.expect(frame.getByLabel('名称', { exact: true })).not.toBeVisible()
    await frame.getByRole('button', { name: '属性', exact: true }).click()
    await frame.getByLabel('名称', { exact: true }).fill('重开保留的属性草稿')
    await playwright.expect.poll(() => JSON.parse(draft.content ?? '{}').ui?.inspector?.draft?.name).toBe('重开保留的属性草稿')
    await page.goto(`${origin}/host.html?locale=en-US`)
    await frame.getByRole('heading', { name: 'Digital twin editor', exact: true }).waitFor()
    await playwright.expect(frame.getByLabel('Name', { exact: true })).toHaveValue('重开保留的属性草稿')
    await playwright.expect(frame.getByRole('status')).toContainText('Unsaved changes')
    await playwright.expect(frame.getByRole('button', { name: 'Add box', exact: true })).toBeEnabled()
    await frame.getByRole('button', { name: 'Add box', exact: true }).click()
    await playwright.expect(frame.getByLabel('Name', { exact: true })).toHaveValue('Box 3')
    await playwright.expect(frame.getByRole('button', { name: 'Apply properties', exact: true })).toBeVisible()
    await frame.getByLabel('New project name', { exact: true }).fill('New twin project')
    await frame.getByLabel('New project name', { exact: true }).press('Enter')
    await playwright.expect(frame.getByRole('alert')).toContainText('write outcome is unconfirmed')
    await playwright.expect(frame.getByLabel('New project name', { exact: true })).toBeDisabled()
    await page.reload()
    await playwright.expect(frame.getByRole('alert')).toContainText('write outcome is unconfirmed')
    await playwright.expect(frame.getByLabel('New project name', { exact: true })).toHaveValue('New twin project')
    await frame.getByRole('button', { name: 'Retry', exact: true }).click()
    await frame.getByRole('button', { name: 'Save as the first scene', exact: true }).click()
    await playwright.expect(frame.getByRole('status')).toContainText('Saved')
    assert.equal(projectList.length, 2, `${engine}: a create retry duplicated the project`)
    assert.ok(documents.get(projectList[1].id).content.includes('Box 3'))
    assert.ok(
      documents.get(projectId).content.includes('球体 2'),
      `${engine}: a new project save overwrote the previous project`
    )
    assert.deepEqual(problems, [], `${engine}: browser errors after locale/create flow`)
    console.log(
      `${engine}: home seed/overwrite refusal/scene/properties/history/validation focus/save replay/conflict/discard/drag/Escape/mobile/i18n/CSP passed`
    )
  } catch (error) {
    const page = browser.contexts()[0]?.pages()[0]
    if (page) {
      console.error(await page.frameLocator('#view').locator('body').ariaSnapshot())
      if (process.env.PROOF_SCREENSHOTS) {
        await mkdir(process.env.PROOF_SCREENSHOTS, { recursive: true })
        await page.screenshot({
          path: join(process.env.PROOF_SCREENSHOTS, `${engine}-failure.png`)
        })
      }
    }
    throw error
  } finally {
    await browser.close()
  }
}

try {
  await prove('chromium', () =>
    playwright.chromium.launch({
      headless: true,
      args: ['--enable-webgl', '--use-angle=swiftshader']
    })
  )
  await prove('webkit', () => playwright.webkit.launch({ headless: true }))
} finally {
  await new Promise((resolve) => server.close(resolve))
}
