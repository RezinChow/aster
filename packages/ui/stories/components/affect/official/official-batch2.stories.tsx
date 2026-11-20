import { useState } from 'react'
import type { Meta, StoryObj } from '@storybook/react'
import { CalendarDays, ListFilter, Pin, Plus } from 'lucide-react'

import type { FormFieldControlProps, OtpStatus } from '../../../../src/components/affect/official'
import {
  Button as ButtonComponent,
  EmailDraft as EmailDraftComponent,
  EmptyState as EmptyStateComponent,
  FilterMenu as FilterMenuComponent,
  FormField as FormFieldComponent,
  HoverCard as HoverCardComponent,
  IconButton as IconButtonComponent,
  Kbd as KbdComponent,
  MessageActions as MessageActionsComponent,
  MessageText,
  NotificationStack as NotificationStackComponent,
  NumberInput as NumberInputComponent,
  OtpInput as OtpInputComponent,
  Pagination as PaginationComponent
} from '../../../../src/components/affect/official'

const meta = {
  title: 'Affect/Official (MIT 1:1)/Components',
  parameters: { layout: 'centered' }
} satisfies Meta

export default meta
type Story = StoryObj<typeof meta>

const canvas = { padding: 24, minWidth: 340 }

/** Verbatim official source · https://www.affectui.com/components/email-draft */
export const EmailDraft: Story = {
  render: () => (
    <div style={{ ...canvas, width: 480 }}>
      <EmailDraftComponent
        reference="SUB-1182"
        account="Northwind Logistics"
        amount="$8,900"
        status="Renews in 5 days"
        agent="Renewal agent"
        contacts={[{ name: 'Jonas Weber', email: 'jonas@northwind.io' }]}
        attachment="Renewal-quote.pdf"
        link={{ label: 'Review quote', href: '/quotes/1182' }}
        onSend={(email) => {
          void email
        }}
      />
    </div>
  )
}

/** Verbatim official source · https://www.affectui.com/components/empty-state */
export const EmptyState: Story = {
  render: () => (
    <div style={canvas}>
      <EmptyStateComponent
        icon={<CalendarDays size={18} />}
        title="No schedules yet"
        text="Runs you ask an agent to repeat show up here, with their next time."
        action={
          <ButtonComponent variant="secondary" size="sm" icon={<Plus size={16} />}>
            New schedule
          </ButtonComponent>
        }
      />
    </div>
  )
}

/** Verbatim official source · https://www.affectui.com/components/filter-menu */
export const FilterMenu: Story = {
  render: () => <DealFiltersDemo />
}

function DealFiltersDemo() {
  const groups = [
    { id: 'stage', label: 'Stage', options: [{ id: 'new', label: 'New lead' }, { id: 'won', label: 'Won' }] },
    { id: 'size', label: 'Deal size', chipPrefix: 'Deal: ', options: [{ id: 's', label: 'Under $5k' }, { id: 'l', label: 'Over $50k' }] }
  ]
  const [filters, setFilters] = useState<Record<string, string[]>>({})
  return (
    <div style={canvas}>
      <FilterMenuComponent groups={groups} value={filters} onChange={setFilters} />
    </div>
  )
}

/** Verbatim official source · https://www.affectui.com/components/form-field */
export const FormField: Story = {
  render: () => <AgentFormDemo />
}

function EffortPicker({ labelId }: FormFieldControlProps & { 'aria-labelledby'?: string }) {
  const levels = ['Quick', 'Balanced', 'Thorough']
  const [effort, setEffort] = useState('Balanced')
  return (
    <div role="group" aria-labelledby={labelId} style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
      {levels.map((level) => (
        <button
          key={level}
          type="button"
          aria-pressed={effort === level}
          onClick={() => setEffort(level)}
          style={{ padding: '6px 12px', borderRadius: 6, border: '1px solid #ddd', background: effort === level ? '#eee' : '#fff', cursor: 'pointer' }}
        >
          {level}
        </button>
      ))}
    </div>
  )
}

function AgentFormDemo() {
  const [name, setName] = useState('')
  const [budget, setBudget] = useState('40')
  const over = Number(budget) > 100

  return (
    <form style={{ ...canvas, display: 'grid', gap: 16, width: 380 }} onSubmit={(e) => e.preventDefault()}>
      <FormFieldComponent label="Agent name" required counter={`${name.length}/40`}>
        <input value={name} maxLength={40} onChange={(e) => setName(e.target.value)} />
      </FormFieldComponent>

      <FormFieldComponent
        label="Budget per run"
        hint="In US dollars – the run stops once it's spent."
        error={over ? 'Your plan allows up to $100 per run.' : undefined}
      >
        <input inputMode="decimal" value={budget} onChange={(e) => setBudget(e.target.value)} />
      </FormFieldComponent>

      {/* Controls that need the ids somewhere else get them as a function */}
      <FormFieldComponent label="Reasoning" hint="How long the agent may think.">
        {(field) => <EffortPicker {...field} aria-labelledby={field.labelId} />}
      </FormFieldComponent>
    </form>
  )
}

/** Verbatim official source · https://www.affectui.com/components/hover-card */
export const HoverCard: Story = {
  render: () => {
    const agent = { id: 'atlas', name: 'Atlas', role: 'Code reviewer', status: 'online' }
    return (
      <div style={{ ...canvas, minHeight: 120 }}>
        <HoverCardComponent
          width={288}
          content={
            <div>
              <strong>{agent.name}</strong>
              <p>{agent.role} · {agent.status}</p>
              <a href={`/agents/${agent.id}`}>Open agent</a>
            </div>
          }
        >
          <a href={`/agents/${agent.id}`}>{agent.name}</a>
        </HoverCardComponent>
      </div>
    )
  }
}

/** Verbatim official source · https://www.affectui.com/components/icon-button */
export const IconButton: Story = {
  render: () => <RunsToolbarDemo />
}

function RunsToolbarDemo() {
  const [pinned, setPinned] = useState(false)
  return (
    <div style={{ ...canvas, display: 'flex', gap: 6 }}>
      <IconButtonComponent variant="secondary" icon={<ListFilter size={16} />} label="Filter" />
      <IconButtonComponent
        variant="secondary"
        icon={<Pin size={16} />}
        label="Pinned runs only"
        pressed={pinned}
        onClick={() => setPinned((p) => !p)}
      />
      <IconButtonComponent variant="primary" icon={<Plus size={16} />} label="New run" />
    </div>
  )
}

/** Verbatim official source · https://www.affectui.com/components/kbd */
export const Kbd: Story = {
  render: () => (
    <div style={canvas}>
      <span>
        Search runs and files <KbdComponent keys={['mod', 'K']} />
      </span>
    </div>
  )
}

/** Verbatim official source · https://www.affectui.com/components/message-actions */
export const MessageActions: Story = {
  render: () => <AssistantMessageDemo />
}

function AssistantMessageDemo() {
  const message = {
    id: 'm-2481',
    versions: [
      'You can retry the run from the Runs page. Open the run and press Rerun — the same agent and inputs are reused.',
      'Open the run on the Runs page and press Rerun. It reuses the same agent and inputs, so nothing has to be reconfigured.',
      'From the Runs page, open the run and choose Rerun. The original agent and inputs are reused automatically.'
    ]
  }
  const [version, setVersion] = useState(message.versions.length - 1)
  const text = message.versions[version]

  return (
    <div style={{ ...canvas, width: 440 }} data-ui-message>
      <MessageText version={version}>{text}</MessageText>
      <MessageActionsComponent
        text={text}
        versions={message.versions}
        version={version}
        onVersionChange={setVersion}
        onRegenerate={() => {}}
        onFeedback={(kind, reason) => {
          void kind
          void reason
        }}
      />
    </div>
  )
}

/** Verbatim official source · https://www.affectui.com/components/notification-stack */
export const NotificationStack: Story = {
  render: () => {
    const notices = [
      {
        id: 'maintenance',
        badge: 'Notice',
        title: 'Scheduled maintenance',
        text: "We'll be offline on Sunday from 02:00 to 03:00 UTC.",
        action: { label: 'View status', href: '/status', external: true },
        pattern: 'grid' as const
      }
    ]
    return (
      <div style={{ ...canvas, width: 380 }}>
        <NotificationStackComponent
          notices={notices}
          onDismiss={(n) => {
            void n.id
          }}
        />
      </div>
    )
  }
}

/** Verbatim official source · https://www.affectui.com/components/number-input */
export const NumberInput: Story = {
  render: () => <RunLimitsDemo />
}

function RunLimitsDemo() {
  const [tokens, setTokens] = useState<number | null>(32000)

  return (
    <form style={{ ...canvas, display: 'grid', gap: 16, width: 320 }} onSubmit={(e) => e.preventDefault()}>
      <NumberInputComponent
        label="Max tokens per run"
        unit="tokens"
        value={tokens}
        onValueChange={setTokens}
        min={1000}
        max={200000}
        step={1000}
        hint="The answer stops here."
      />
      <NumberInputComponent
        label="Budget per run"
        name="budget"
        prefix="$"
        defaultValue={25}
        min={0}
        max={100}
        step={5}
        formatOptions={{ minimumFractionDigits: 2, maximumFractionDigits: 2 }}
      />
    </form>
  )
}

/** Verbatim official source · https://www.affectui.com/components/otp-input */
export const OtpInput: Story = {
  render: () => <VerifyEmailDemo />
}

function VerifyEmailDemo() {
  const [code, setCode] = useState('')
  const [status, setStatus] = useState<OtpStatus>('idle')
  const [triesLeft, setTriesLeft] = useState(3)

  async function verify(value: string) {
    setStatus('verifying')
    await new Promise<void>((resolve) => window.setTimeout(resolve, 700))
    if (value === '123456') {
      setStatus('success')
    } else {
      setTriesLeft((n) => n - 1)
      setStatus('error')
    }
  }

  return (
    <div style={{ ...canvas, width: 360 }}>
      <OtpInputComponent
        value={code}
        onChange={(next) => {
          setCode(next)
          if (status === 'error' && next) setStatus('idle')
        }}
        onComplete={verify}
        status={status}
        errorMessage={`That code didn't work. ${triesLeft} tries left.`}
        separator
        autoFocus
        onResend={() => {}}
        resendIn={30}
      />
    </div>
  )
}

/** Verbatim official source · https://www.affectui.com/components/pagination */
export const Pagination: Story = {
  render: () => <RunsFooterDemo />
}

function RunsFooterDemo() {
  const total = 1284
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(25)

  return (
    <div style={{ ...canvas, width: 560 }}>
      <PaginationComponent
        page={page}
        onPageChange={setPage}
        total={total}
        pageSize={pageSize}
        pageSizes={[25, 50, 100]}
        onPageSizeChange={setPageSize}
      />
    </div>
  )
}
