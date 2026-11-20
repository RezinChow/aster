import type { Meta, StoryObj } from '@storybook/react'

import { CalendarDays, Cloud, Database, FileText, Mail, MessageSquare, Sparkles, Zap } from 'lucide-react'

import {
  AgentTeam as AgentTeamComponent,
  CoverFlow as CoverFlowComponent,
  EmptyCalendar as EmptyCalendarComponent,
  EnrichmentOrbit as EnrichmentOrbitComponent,
  FrostCloud as FrostCloudComponent,
  GhostedChat as GhostedChatComponent,
  GlowCloud as GlowCloudComponent,
  IntegrationBeam as IntegrationBeamComponent,
  IntegrationGrid as IntegrationGridComponent,
  LayerStack as LayerStackComponent,
  LeadSourcing as LeadSourcingComponent,
  LogoCluster as LogoClusterComponent,
  ModelWheel as ModelWheelComponent,
  RegionDach as RegionDachComponent,
  SideFolder as SideFolderComponent,
  TabOverload as TabOverloadComponent,
  TeamInvite as TeamInviteComponent
} from '../../../../src/components/affect/official'

const meta = {
  title: 'Affect/Official (MIT 1:1)/Illustrations',
  parameters: { layout: 'centered' }
} satisfies Meta

export default meta
type Story = StoryObj<typeof meta>

/** 600 × 400 illustrations frame */
const wide = { width: 600, maxWidth: '100%' }
/** Smaller card illustrations frame */
const card = { width: 460, maxWidth: '100%' }

/** Inline avatar so the stories have no network dependency */
const avatar = (bg: string, initials: string) =>
  `data:image/svg+xml,${encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="80" height="80"><rect width="80" height="80" fill="${bg}"/><text x="40" y="53" text-anchor="middle" font-family="sans-serif" font-size="32" font-weight="600" fill="#ffffff">${initials}</text></svg>`
  )}`

/** Verbatim official source · https://www.affectui.com/illustrations/agent-team */
export const AgentTeam: Story = {
  render: () => (
    <div style={wide}>
      <AgentTeamComponent
        prompt="Build a team to work my inbound pipeline"
        members={[
          { role: 'Outreach', avatar: avatar('#5B8DEF', 'A'), tools: ['linkedin', 'hubspot'] },
          { role: 'Research', avatar: avatar('#8B5CF6', 'R'), tools: ['gmail', 'slack'] },
          { role: 'Closing', avatar: avatar('#0EA5A4', 'C'), tools: ['salesforce', 'gmail'] }
        ]}
      />
    </div>
  )
}

/** Verbatim official source · https://www.affectui.com/illustrations/cover-flow */
export const CoverFlow: Story = {
  render: () => {
    const cover = (from: string, to: string, label: string) => (
      <div style={{ display: 'grid', placeItems: 'center', width: '100%', height: '100%', background: `linear-gradient(135deg, ${from}, ${to})`, color: '#fff', fontSize: 40, fontWeight: 700 }}>
        {label}
      </div>
    )
    return (
      <div style={wide}>
        <CoverFlowComponent
          items={[
            { id: 1, title: 'Aurora', subtitle: 'Chapter one', cover: cover('#7C3AED', '#2563EB', '1') },
            { id: 2, title: 'Bloom', subtitle: 'Chapter two', cover: cover('#DB2777', '#F97316', '2') },
            { id: 3, title: 'Cobalt', subtitle: 'Chapter three', cover: cover('#0EA5E9', '#14B8A6', '3') },
            { id: 4, title: 'Dune', subtitle: 'Chapter four', cover: cover('#F59E0B', '#EF4444', '4') },
            { id: 5, title: 'Ember', subtitle: 'Chapter five', cover: cover('#10B981', '#3B82F6', '5') },
            { id: 6, title: 'Fjord', subtitle: 'Chapter six', cover: cover('#6366F1', '#A855F7', '6') }
          ]}
        />
      </div>
    )
  }
}

/** Verbatim official source · https://www.affectui.com/illustrations/empty-calendar */
export const EmptyCalendar: Story = {
  render: () => (
    <div style={card}>
      <EmptyCalendarComponent />
    </div>
  )
}

/** Verbatim official source · https://www.affectui.com/illustrations/enrichment-orbit */
export const EnrichmentOrbit: Story = {
  render: () => (
    <div style={card}>
      <EnrichmentOrbitComponent />
    </div>
  )
}

/** Verbatim official source · https://www.affectui.com/illustrations/frost-cloud */
export const FrostCloud: Story = {
  render: () => (
    <div style={{ ...wide, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
      <FrostCloudComponent color="blue" />
      <FrostCloudComponent color="orange" />
      <FrostCloudComponent color="blue" background={false} />
    </div>
  )
}

/** Verbatim official source · https://www.affectui.com/illustrations/ghosted-chat */
export const GhostedChat: Story = {
  render: () => (
    <div style={card}>
      <GhostedChatComponent />
    </div>
  )
}

/** Verbatim official source · https://www.affectui.com/illustrations/glow-cloud */
export const GlowCloud: Story = {
  render: () => (
    <div style={{ ...wide, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
      <GlowCloudComponent color="blue" />
      <GlowCloudComponent color="orange" />
    </div>
  )
}

/** Verbatim official source · https://www.affectui.com/illustrations/integration-beam */
export const IntegrationBeam: Story = {
  render: () => (
    <div style={wide}>
      <IntegrationBeamComponent
        left={[
          { name: 'Mail', logo: <Mail size={20} /> },
          { name: 'Chat', logo: <MessageSquare size={20} /> },
          { name: 'Storage', logo: <Database size={20} /> }
        ]}
        right={[
          { name: 'Docs', logo: <FileText size={20} /> },
          { name: 'Calendar', logo: <CalendarDays size={20} /> },
          { name: 'Cloud', logo: <Cloud size={20} /> }
        ]}
        center={{ name: 'Aster', logo: <Zap size={22} /> }}
      />
    </div>
  )
}

/** Verbatim official source · https://www.affectui.com/illustrations/integration-grid */
export const IntegrationGrid: Story = {
  render: () => (
    <div style={{ ...wide, width: 720 }}>
      <IntegrationGridComponent
        columns={9}
        mark={<Sparkles size={42} />}
        logos={[
          { name: 'Circle', path: 'M12 2a10 10 0 1 0 0 20 10 10 0 1 0 0-20z', color: '#5B8DEF' },
          { name: 'Square', path: 'M4 4h16v16H4z', color: '#8B5CF6' },
          { name: 'Triangle', path: 'M12 3 22 20H2z', color: '#0EA5A4' },
          { name: 'Diamond', path: 'M12 2 22 12 12 22 2 12z', color: '#F59E0B' },
          { name: 'Star', path: 'M12 2l3 7h7l-5.5 4.5 2 7.5L12 17l-6.5 4 2-7.5L2 9h7z', color: '#EC4899' },
          { name: 'Hexagon', path: 'M12 2 21 7v10l-9 5-9-5V7z', color: '#14B8A6' },
          { name: 'Pentagon', path: 'M12 2 22 9l-4 12H6L2 9z', color: '#6366F1' },
          { name: 'Ring', path: 'M12 2a10 10 0 1 0 0 20 10 10 0 1 0 0-20zm0 4a6 6 0 1 1 0 12 6 6 0 1 1 0-12z', color: '#EF4444' },
          { name: 'Cross', path: 'M9 2h6v7h7v6h-7v7H9v-7H2V9h7z', color: '#3B82F6' },
          { name: 'Wave', path: 'M2 12c3-8 5 8 10 0s7 8 10 0v9H2z', color: '#A855F7' }
        ]}
      />
    </div>
  )
}

/** Verbatim official source · https://www.affectui.com/illustrations/layer-stack */
export const LayerStack: Story = {
  render: () => (
    <div style={wide}>
      <LayerStackComponent
        items={[
          { title: 'Triggered by events', hint: 'Webhooks', icon: 'bolt' },
          { title: 'Grounded in your data', hint: 'Context', icon: 'database' },
          { title: 'Connected to your apps', hint: 'APIs', icon: 'plug' },
          { title: 'Works with any model', hint: 'Routing', icon: 'spark' },
          { title: 'Traced at every step', hint: 'Logs', icon: 'pulse' }
        ]}
      />
    </div>
  )
}

/** Verbatim official source · https://www.affectui.com/illustrations/lead-sourcing */
export const LeadSourcing: Story = {
  render: () => (
    <div style={card}>
      <LeadSourcingComponent />
    </div>
  )
}

/** Verbatim official source · https://www.affectui.com/illustrations/logo-cluster */
export const LogoCluster: Story = {
  render: () => (
    <div style={{ width: 420, maxWidth: '100%' }}>
      <LogoClusterComponent />
    </div>
  )
}

/** Verbatim official source · https://www.affectui.com/illustrations/model-wheel */
export const ModelWheel: Story = {
  render: () => (
    <div style={{ width: 420, maxWidth: '100%' }}>
      <ModelWheelComponent
        models={[
          { name: 'Astra', viewBox: '0 0 24 24', color: '#D97757', d: 'M12 2l3 7h7l-5.5 4.5 2 7.5L12 17l-6.5 4 2-7.5L2 9h7z' },
          { name: 'Nova', viewBox: '0 0 24 24', color: '#8E75B2', d: 'M12 2a10 10 0 1 0 0 20 10 10 0 1 0 0-20z' },
          { name: 'Quanta', viewBox: '0 0 24 24', color: '#1FB8CD', d: 'M12 2 22 12 12 22 2 12z' },
          { name: 'Pulse', viewBox: '0 0 24 24', color: '#5786FE', d: 'M2 12h5l3-8 4 16 3-8h5' },
          { name: 'Mira', viewBox: '0 0 24 24', color: '#FA520F', d: 'M4 4h16v16H4z' },
          { name: 'Orbit', viewBox: '0 0 24 24', color: '#6950EF', d: 'M12 3a9 9 0 1 0 0 18 9 9 0 1 0 0-18zm0 5a4 4 0 1 1 0 8 4 4 0 1 1 0-8z' },
          { name: 'Flux', viewBox: '0 0 24 24', color: '#0467DF', d: 'M12 2 21 7v10l-9 5-9-5V7z' },
          { name: 'Lumen', viewBox: '0 0 24 24', color: '#EC4899', d: 'M12 2l3 7h7l-5.5 4.5 2 7.5L12 17l-6.5 4 2-7.5L2 9h7z' }
        ]}
      />
    </div>
  )
}

/** Verbatim official source · https://www.affectui.com/illustrations/region-dach */
export const RegionDach: Story = {
  render: () => (
    <div style={{ display: 'flex', gap: 24, alignItems: 'flex-start', flexWrap: 'wrap' }}>
      <div style={{ width: 440, maxWidth: '100%' }}>
        <RegionDachComponent defaultRegion="dach" />
      </div>
      <div style={{ width: 440, maxWidth: '100%' }}>
        <RegionDachComponent defaultRegion="us" showSwitcher={false} />
      </div>
    </div>
  )
}

/** Verbatim official source · https://www.affectui.com/illustrations/side-folder */
export const SideFolder: Story = {
  render: () => (
    <div style={card}>
      <SideFolderComponent />
    </div>
  )
}

/** Verbatim official source · https://www.affectui.com/illustrations/tab-overload */
export const TabOverload: Story = {
  render: () => (
    <div style={card}>
      <TabOverloadComponent />
    </div>
  )
}

/** Verbatim official source · https://www.affectui.com/illustrations/team-invite */
export const TeamInvite: Story = {
  render: () => (
    <div style={wide}>
      <TeamInviteComponent
        avatars={[
          { src: avatar('#5B8DEF', 'L'), name: 'Lena' },
          { src: avatar('#8B5CF6', 'K'), name: 'Kai' },
          { src: avatar('#0EA5A4', 'M'), name: 'Mira' }
        ]}
      />
    </div>
  )
}
