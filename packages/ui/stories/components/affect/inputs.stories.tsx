import type { Meta, StoryObj } from '@storybook/react'
import { Store } from 'lucide-react'
import { useState } from 'react'

import type { CatalogItem, ScheduleLine } from '../../../src/components/affect/inputs/billing-schedule'
import type { ComboboxOption } from '../../../src/components/affect/inputs/combobox'
import type { FilterGroup, FilterValue } from '../../../src/components/affect/inputs/filter-menu'
import type { PromptTemplate } from '../../../src/components/affect/inputs/prompt-library'
import type { Step } from '../../../src/components/affect/inputs/stepper-form'
import {
  BillingSchedule as BillingScheduleComponent,
  Checkbox as CheckboxComponent,
  ColorPicker as ColorPickerComponent,
  Combobox as ComboboxComponent,
  DatePicker as DatePickerComponent,
  DateRangePicker as DateRangePickerComponent,
  Dropzone as DropzoneComponent,
  FilterMenu as FilterMenuComponent,
  FormField as FormFieldComponent,
  IntegrationSettings as IntegrationSettingsComponent,
  NumberInput as NumberInputComponent,
  OtpInput as OtpInputComponent,
  PromptLibrary as PromptLibraryComponent,
  Rating as RatingComponent,
  Select as SelectComponent,
  StepperField,
  StepperForm as StepperFormComponent,
  StepperInput,
  Switch as SwitchComponent,
  TagInput as TagInputComponent,
  TextArea as TextAreaComponent,
  TextField as TextFieldComponent,
  TimePicker as TimePickerComponent
} from '../../../src/components/affect'

const meta = {
  title: 'Affect/Components/Inputs',
  parameters: { layout: 'padded' },
  tags: ['autodocs']
} satisfies Meta

export default meta
type Story = StoryObj

const catalog: CatalogItem[] = [
  { name: 'Research agent', repeat: 'monthly', price: 49 },
  { name: 'Setup fee', repeat: 'once', price: 200 }
]

const defaultLines: ScheduleLine[] = [
  { id: 'line-1', name: 'Research agent', quantity: 2, repeat: 'monthly', price: 49 }
]

const people: ComboboxOption[] = [
  { value: 'maya', label: 'Maya Chen', hint: 'Product Designer', avatar: true, group: 'Design' },
  { value: 'sara', label: 'Sara Okafor', hint: 'Staff Engineer', avatar: true, group: 'Engineering' },
  { value: 'elif', label: 'Elif Yilmaz', hint: 'Head of Product', avatar: true, group: 'Product' }
]

const filterGroups: FilterGroup[] = [
  {
    id: 'stage',
    label: 'Stage',
    options: [{ id: 'new', label: 'New lead' }, { id: 'won', label: 'Won' }]
  },
  {
    id: 'size',
    label: 'Deal size',
    chipPrefix: 'Deal: ',
    options: [{ id: 's', label: 'Under $5k' }, { id: 'l', label: 'Over $50k' }]
  }
]

const templates: PromptTemplate[] = [
  {
    id: 'meeting',
    title: 'Summarize a meeting',
    category: 'Notes',
    body: 'Summarize the meeting below for {audience} in under {length}.',
    variables: { length: { default: '150 words' } }
  },
  {
    id: 'error',
    title: 'Explain an error',
    category: 'Debug',
    body: 'Explain this {language} error in plain words: {error}.'
  }
]

type OnboardingValues = { name: string; slug: string }

const onboardingSteps: Step<OnboardingValues>[] = [
  {
    id: 'workspace',
    title: 'Workspace',
    heading: 'Name your workspace',
    render: ({ values, setValues }) => (
      <>
        <StepperField name="name" label="Workspace name">
          <StepperInput
            value={values.name}
            onChange={(event) => setValues({ name: event.target.value })}
          />
        </StepperField>
        <StepperField name="slug" label="Workspace URL">
          <StepperInput
            prefix="acme.app/"
            value={values.slug}
            onChange={(event) => setValues({ slug: event.target.value })}
          />
        </StepperField>
      </>
    ),
    validate: (values) => ({
      name: values.name.trim() ? undefined : 'Give your workspace a name'
    })
  },
  {
    id: 'review',
    title: 'Review',
    heading: 'Review your workspace',
    render: ({ values }) => (
      <p className="text-sm text-muted-foreground">
        Workspace: {values.name || '—'} · URL: acme.app/{values.slug || '—'}
      </p>
    )
  }
]

export const BillingSchedule: Story = {
  render: () => (
    <div className="w-full max-w-xl">
      <BillingScheduleComponent
        phase="Build-out phase"
        defaultStart="2026-01-01"
        catalog={catalog}
        defaultLines={defaultLines}
        onChange={() => {}}
      />
    </div>
  )
}

export const Checkbox: Story = {
  render: () => (
    <div className="w-full max-w-md space-y-3">
      <CheckboxComponent
        label="Send notifications"
        description="Email me when a run needs approval"
        defaultChecked
      />
      <CheckboxComponent
        variant="card"
        label="Include usage report"
        description="Attach a summary of this billing period"
      />
    </div>
  )
}

export const ColorPicker: Story = {
  render: function ColorPickerStory() {
    const [color, setColor] = useState('#0190fe')
    return (
      <div className="w-full max-w-md">
        <ColorPickerComponent
          label="Agent color"
          value={color}
          onValueChange={setColor}
          presets={[
            { value: '#0190fe', label: 'Blue' },
            { value: '#13b3a0', label: 'Teal' },
            { value: '#e8b000', label: 'Amber' }
          ]}
        />
      </div>
    )
  }
}

export const Combobox: Story = {
  render: function ComboboxStory() {
    const [values, setValues] = useState<string[]>(['maya'])
    return (
      <div className="w-full max-w-md">
        <ComboboxComponent
          label="Reviewers"
          options={people}
          value={values}
          onChange={setValues}
          placeholder="Add reviewers…"
          maxVisibleTags={4}
        />
      </div>
    )
  }
}

export const DatePicker: Story = {
  render: function DatePickerStory() {
    const [day, setDay] = useState<Date | null>(null)
    return (
      <div className="w-full max-w-md">
        <DatePickerComponent
          label="First run"
          value={day}
          onChange={setDay}
          hint="Research Agent only runs on weekdays."
          name="firstRun"
        />
      </div>
    )
  }
}

export const DateRangePicker: Story = {
  render: () => (
    <div className="w-full max-w-md">
      <DateRangePickerComponent
        defaultValue={{ start: new Date(2026, 0, 1), end: new Date(2026, 0, 31) }}
        onChange={() => {}}
      />
    </div>
  )
}

export const Dropzone: Story = {
  render: () => (
    <div className="w-full max-w-md">
      <DropzoneComponent
        accept={['.pdf', '.png', '.jpg']}
        maxSize={10 * 1024 * 1024}
        hint="Drop PDF or image files here, up to 10 MB each."
      />
    </div>
  )
}

export const FilterMenu: Story = {
  render: function FilterMenuStory() {
    const [filters, setFilters] = useState<FilterValue>({})
    return (
      <div className="w-full max-w-md">
        <FilterMenuComponent groups={filterGroups} value={filters} onChange={setFilters} />
      </div>
    )
  }
}

export const FormField: Story = {
  render: function FormFieldStory() {
    const [name, setName] = useState('')
    return (
      <div className="w-full max-w-md">
        <FormFieldComponent
          label="Agent name"
          required
          counter={`${name.length}/40`}
          hint="Shown in the sidebar"
        >
          <input
            className="w-full rounded-md border border-border bg-background px-2.5 py-1.5 text-sm"
            value={name}
            maxLength={40}
            onChange={(event) => setName(event.target.value)}
          />
        </FormFieldComponent>
      </div>
    )
  }
}

export const IntegrationSettings: Story = {
  render: () => (
    <div className="w-full max-w-xl">
      <IntegrationSettingsComponent
        name="Shopify store"
        logo={<Store className="size-4" />}
        meta="Connected on March 4, 2026"
        defaultValues={{ siteUrl: 'lumen-studio.com' }}
        onSave={() => {}}
      />
    </div>
  )
}

export const NumberInput: Story = {
  render: () => (
    <div className="w-full max-w-md">
      <NumberInputComponent
        label="Monthly budget"
        defaultValue={1200}
        min={0}
        max={10000}
        step={100}
        unit="$"
      />
    </div>
  )
}

export const OtpInput: Story = {
  render: () => (
    <div className="w-full max-w-md">
      <OtpInputComponent label="Verification code" length={6} onComplete={() => {}} />
    </div>
  )
}

export const PromptLibrary: Story = {
  render: () => (
    <div className="w-full max-w-xl">
      <PromptLibraryComponent templates={templates} defaultValue="meeting" onUse={() => {}} />
    </div>
  )
}

export const Rating: Story = {
  render: () => (
    <div className="w-full max-w-md">
      <RatingComponent aria-label="Rate this run" defaultValue={4} />
    </div>
  )
}

export const Select: Story = {
  render: () => (
    <div className="w-full max-w-md">
      <SelectComponent
        label="Model"
        options={[
          { value: 'auto', label: 'Auto', description: 'Picks the best model' },
          { value: 'opus', label: 'Opus', description: 'Deep reasoning' },
          { value: 'flash', label: 'Flash', description: 'Fast and cheap' }
        ]}
        defaultValue="auto"
      />
    </div>
  )
}

export const StepperForm: Story = {
  render: () => (
    <div className="w-full max-w-xl">
      <StepperFormComponent<OnboardingValues>
        steps={onboardingSteps}
        initialValues={{ name: '', slug: '' }}
        submitLabel="Create workspace"
        onComplete={() => {}}
      />
    </div>
  )
}

export const Switch: Story = {
  render: () => (
    <div className="w-full max-w-md space-y-3">
      <SwitchComponent
        label="Auto-approve safe tools"
        description="Only read-only tools"
        defaultChecked
      />
      <SwitchComponent label="Weekly summary" description="Sent every Monday" />
    </div>
  )
}

export const TagInput: Story = {
  render: () => (
    <div className="w-full max-w-md">
      <TagInputComponent
        label="Reviewers"
        defaultValue={['mira', 'lyon']}
        placeholder="Add a name"
      />
    </div>
  )
}

export const TextArea: Story = {
  render: () => (
    <div className="w-full max-w-md">
      <TextAreaComponent
        label="Description"
        placeholder="What should this agent do?"
        hint="Shown on the agent detail page"
        minRows={3}
        counter
        onChange={() => {}}
      />
    </div>
  )
}

export const TextField: Story = {
  render: () => (
    <div className="w-full max-w-md">
      <TextFieldComponent
        label="Project name"
        hint="Shown in the sidebar"
        placeholder="Launch pricing"
      />
    </div>
  )
}

export const TimePicker: Story = {
  render: () => (
    <div className="w-full max-w-md">
      <TimePickerComponent label="Start time" defaultValue="09:30" hourCycle={24} />
    </div>
  )
}
