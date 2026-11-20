import { test, expect } from '@playwright/test'
async function login(page, role) {
  await page.goto('/')
  await page.getByRole('button', { name: role, exact: true }).click()
  await page
    .getByLabel('Password', { exact: true })
    .fill(process.env.DEMO_PASSWORD)
  await page.getByRole('button', { name: 'Sign in', exact: true }).click()
}
test('an employee sees the laptop approval unlock setup, cites a policy and contacts HR', async ({
  page,
  browser,
}) => {
  await login(page, 'Employee')
  await page
    .getByRole('button', { name: 'My Tasks', exact: true })
    .first()
    .click()
  const setup = page.getByRole('button', { name: /Set up your workstation/ })
  await expect(setup).toContainText('Blocked')
  const mgr = await browser.newPage()
  await login(mgr, 'Manager')
  await mgr.getByRole('button', { name: 'Decisions', exact: true }).click()
  await mgr
    .locator('.decision')
    .filter({ hasText: 'Approve laptop request' })
    .filter({ hasText: 'Alex Park' })
    .getByRole('button', { name: 'Approve', exact: true })
    .click()
  await expect(
    mgr
      .locator('.decision')
      .filter({ hasText: 'Approve laptop request' })
      .filter({ hasText: 'Alex Park' }),
  ).toHaveCount(0)
  await page.getByRole('button', { name: 'Refresh' }).click()
  await expect(setup).toContainText('Available')
  await page.getByRole('button', { name: 'AI Assistant' }).click()
  await page.getByRole('button', { name: 'When do benefits begin?' }).click()
  await page.getByText('Benefits enrollment', { exact: true }).click()
  await expect(page.locator('details[open]')).toContainText('start date')
  await page.getByLabel('Ask a question').fill('Is relocation covered?')
  await page.getByRole('button', { name: 'Send question', exact: true }).click()
  page.once('dialog', (d) => d.accept())
  await page
    .locator('.response')
    .filter({ hasText: 'Is relocation covered?' })
    .getByRole('button', { name: 'Send question to HR' })
    .click()
  await expect(page.getByRole('button', { name: 'Sent to HR' })).toBeVisible()
  const hr = await browser.newPage()
  await login(hr, 'HR')
  await hr.getByRole('button', { name: 'HR inbox' }).click()
  await hr.getByRole('button', { name: /Is relocation covered/ }).click()
  await hr
    .getByLabel('Reply to employee')
    .fill('I will send you the relocation guide.')
  await hr.getByRole('button', { name: 'Send reply' }).click()
  await expect(
    hr.getByText('I will send you the relocation guide.'),
  ).toBeVisible()
  await page.getByRole('button', { name: 'Help & Support' }).click()
  await page.getByRole('button', { name: /Is relocation covered/ }).click()
  await expect(
    page.getByText('I will send you the relocation guide.'),
  ).toBeVisible()
  await hr.getByRole('button', { name: 'Employees', exact: true }).click()
  await hr.getByRole('button', { name: 'Preview move to Austin' }).click()
  await hr.getByRole('button', { name: 'Cancel' }).click()
  await expect(
    hr.getByRole('button', { name: 'Preview move to Austin' }),
  ).toBeVisible()
  await mgr.close()
  await hr.close()
})

test('HR creates an operations hire and applies a reviewed office move', async ({
  page,
}) => {
  await login(page, 'HR')
  await page.getByRole('button', { name: 'New hire' }).click()
  await page.getByLabel('Full name').fill('Robin West')
  await page.getByLabel('Work email').fill('robin@joinflow.example')
  await page.getByLabel('Personal email').fill('robin@example.test')
  await page.getByLabel('Department').fill('Operations')
  await page.getByLabel('Start date').fill('2027-02-15')
  await page.getByLabel('Job role').selectOption('Operations')
  await page.getByRole('button', { name: 'Create checklist' }).click()
  await expect(
    page.getByRole('heading', { name: 'Review onboarding plan' }),
  ).toBeVisible()
  await page.getByRole('button', { name: 'Employees', exact: true }).click()
  await page.getByRole('combobox').selectOption({ label: 'Robin West' })
  await expect(
    page.getByText(/Review operations playbook · Draft/),
  ).toBeVisible()
  await page.getByRole('button', { name: 'Preview move to Austin' }).click()
  await page.getByRole('button', { name: 'Apply change' }).click()
  await expect(
    page.getByText(/Collect Austin access pass · Draft/),
  ).toBeVisible()
  await expect(
    page.getByText(/Collect London access pass · Draft/),
  ).toHaveCount(0)
  await page.getByRole('button', { name: 'History', exact: true }).click()
  await expect(
    page.getByText('Changed location from London to Austin.'),
  ).toBeVisible()
})

test('manager publishes a new policy, employee retrieves it and dashboard links support Back', async ({
  page,
  browser,
}) => {
  await login(page, 'Manager')
  await page.getByRole('button', { name: 'Active hires' }).click()
  await expect(
    page.getByRole('heading', { name: 'Active', exact: true }),
  ).toBeVisible()
  await page.getByRole('button', { name: '← Back', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Active hires' })).toBeVisible()
  await page.getByRole('button', { name: 'Policies', exact: true }).click()
  const create = page
    .locator('section')
    .filter({ has: page.getByRole('heading', { name: 'New policy' }) })
  await create.getByLabel('Policy title').fill('Bicycle storage')
  await create
    .getByLabel('Policy text')
    .fill('Store bicycles in the orchid courtyard.')
  await create.getByRole('button', { name: 'Add policy' }).click()
  await expect(
    page.locator('summary').filter({ hasText: 'Bicycle storage' }),
  ).toContainText('Ready')
  const employee = await browser.newPage()
  await login(employee, 'Employee')
  await employee
    .getByRole('navigation')
    .getByRole('button', { name: 'AI Assistant' })
    .click()
  await employee.getByLabel('Ask a question').fill('Where is bicycle storage?')
  await employee
    .getByRole('button', { name: 'Send question', exact: true })
    .click()
  await expect(employee.locator('.response').last()).toContainText(
    'orchid courtyard',
  )
  await employee.close()
})
test('employee submits a document and sees HR feedback in the portal', async ({
  page,
  browser,
}) => {
  await login(page, 'Employee')
  await page.getByRole('button', { name: 'My Documents' }).click()
  const offer = page.locator('article').filter({ hasText: 'Signed offer' })
  await offer.getByLabel('PDF, up to 5 MB').setInputFiles({
    name: 'offer.pdf',
    mimeType: 'application/pdf',
    buffer: Buffer.from('%PDF-1.4 synthetic test'),
  })
  await offer.getByRole('button', { name: 'Submit document' }).click()
  await expect(offer).toContainText('Needs HR Review')
  const hr = await browser.newPage()
  await login(hr, 'HR')
  await hr.getByRole('button', { name: 'Documents', exact: true }).click()
  await hr.getByLabel('Decision').selectOption('Rejected')
  await hr
    .getByLabel('Reason (required for rejection)')
    .fill('Please upload the signed copy.')
  await hr.getByRole('button', { name: 'Submit review' }).click()
  await expect(hr.locator('.handoff')).toContainText('Rejected')
  await page.getByRole('button', { name: 'Refresh' }).click()
  await expect(offer).toContainText('Please upload the signed copy.')
  await expect(
    offer.getByRole('button', { name: 'Replace document' }),
  ).toBeVisible()
  await hr.close()
})

test('an employee opens a support ticket, receives an HR reply and follows the notification', async ({
  page,
  browser,
}) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await login(page, 'Employee')
  await page.getByRole('button', { name: 'Help & Support' }).click()
  await page.getByRole('button', { name: 'New Request', exact: true }).click()
  await page.getByLabel('Category').selectOption('Company email')
  await page.getByLabel('Description').fill('Unable to open my work mailbox.')
  await page.getByRole('button', { name: 'Create request' }).click()
  await expect(page.getByRole('status')).toContainText('Request created')
  const hr = await browser.newPage()
  await login(hr, 'HR')
  await hr.getByRole('button', { name: 'HR inbox' }).click()
  await hr.getByRole('button', { name: /Alex Park Company email/ }).click()
  await hr.getByLabel('Issue status').selectOption('Waiting for Employee')
  await hr
    .getByLabel('Response', { exact: true })
    .fill('Please try your work email again.')
  await hr.getByRole('button', { name: 'Update issue' }).click()
  await expect(hr.locator('.ticket-detail .conversation')).toContainText(
    'Please try your work email again.',
  )
  await page.getByRole('button', { name: 'Notifications', exact: true }).click()
  await page
    .getByRole('button', { name: /Company email · Waiting for Employee/ })
    .click()
  await expect(page.locator('.ticket-detail')).toContainText(
    'Please try your work email again.',
  )
  await page.getByLabel('Response', { exact: true }).fill('It works now.')
  await page.getByRole('button', { name: 'Send reply' }).click()
  await expect(page.locator('.conversation')).toContainText('It works now.')
  await hr.close()
})

test('HR investigates a delayed task and filters the task register', async ({page}) => {
  await login(page,'HR')
  await page.getByRole('button',{name:'Escalations',exact:true}).click()
  await page.getByRole('button',{name:'Delayed Tasks'}).click()
  const delayed=page.locator('article.handoff').first()
  await delayed.getByRole('button',{name:'Investigate task'}).click()
  const detail=page.getByLabel('Task details')
  await expect(detail).toBeVisible()
  await expect(detail.locator('details')).not.toHaveAttribute('open','')
  await detail.getByText('Activity history').click()
  await expect(detail.locator('details')).toHaveAttribute('open','')
  await detail.getByRole('button',{name:'Close details'}).click()
  await page.getByLabel('Employee',{exact:true}).fill('Alex Park')
  const rows=page.locator('tbody tr')
  await expect(rows.first()).toContainText('Alex Park')
  await expect(rows.filter({hasText:'Maya'})).toHaveCount(0)
  await page.getByRole('combobox',{name:'Department',exact:true}).selectOption('IT')
  await expect(rows.first().locator('td').nth(2)).toHaveText('IT')
})
