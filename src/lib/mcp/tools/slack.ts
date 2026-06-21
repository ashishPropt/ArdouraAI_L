import type { MCPToolResult } from '../registry'

interface SlackConfig {
  webhookUrl?: string
  botToken?: string
  channel?: string
}

const SEVERITY_COLORS: Record<string, string> = {
  P1: '#FF0000', P2: '#FF6600', P3: '#FFCC00', P4: '#36A64F',
}

async function slackPost(url: string, body: unknown, headers?: Record<string, string>) {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...headers },
    body: JSON.stringify(body),
  })
  const text = await res.text()
  if (!res.ok && text !== 'ok') throw new Error(`Slack error ${res.status}: ${text}`)
  return text
}

export async function slackTool(
  action: string,
  params: Record<string, unknown>,
  config: Record<string, unknown>
): Promise<MCPToolResult> {
  const cfg = config as SlackConfig
  const channel = (params.channel as string) ?? cfg.channel ?? '#general'

  switch (action) {
    case 'send_message': {
      if (cfg.botToken) {
        await slackPost('https://slack.com/api/chat.postMessage', { channel, text: params.text }, { Authorization: `Bearer ${cfg.botToken}` })
      } else if (cfg.webhookUrl) {
        await slackPost(cfg.webhookUrl, { text: params.text })
      } else {
        return { success: false, error: 'No Slack token or webhook configured' }
      }
      return { success: true, data: { sent: true, channel } }
    }

    case 'send_alert': {
      const color = SEVERITY_COLORS[params.severity as string] ?? '#888888'
      const attachment = {
        color,
        title: `[${params.severity}] ${params.title}`,
        text: params.body as string,
        footer: 'ArdouraAI SRE',
        ts: Math.floor(Date.now() / 1000),
        mrkdwn_in: ['text'],
      }
      if (cfg.botToken) {
        await slackPost('https://slack.com/api/chat.postMessage', { channel, attachments: [attachment] }, { Authorization: `Bearer ${cfg.botToken}` })
      } else if (cfg.webhookUrl) {
        await slackPost(cfg.webhookUrl, { attachments: [attachment] })
      } else {
        return { success: false, error: 'No Slack token or webhook configured' }
      }
      return { success: true, data: { sent: true, severity: params.severity, channel } }
    }

    case 'send_hitl_card': {
      if (!cfg.botToken) return { success: false, error: 'Bot token required for interactive HITL cards' }
      const color = SEVERITY_COLORS[params.riskLevel as string] ?? '#888888'
      const approveUrl = `${process.env.NEXTAUTH_URL}/api/heal/${params.healActionId}/approve`
      const rejectUrl = `${process.env.NEXTAUTH_URL}/api/heal/${params.healActionId}/reject`
      const blocks = [
        { type: 'header', text: { type: 'plain_text', text: `🔧 Healing Proposal: ${params.title}` } },
        { type: 'section', text: { type: 'mrkdwn', text: `*Risk:* ${params.riskLevel}\n\n${params.description}` } },
        { type: 'section', text: { type: 'mrkdwn', text: `*Action ID:* \`${params.healActionId}\`` } },
        {
          type: 'actions',
          elements: [
            { type: 'button', text: { type: 'plain_text', text: '✅ Approve' }, style: 'primary', url: approveUrl },
            { type: 'button', text: { type: 'plain_text', text: '❌ Reject' }, style: 'danger', url: rejectUrl },
          ],
        },
      ]
      await slackPost('https://slack.com/api/chat.postMessage', { channel, blocks, attachments: [{ color }] }, { Authorization: `Bearer ${cfg.botToken}` })
      return { success: true, data: { sent: true, healActionId: params.healActionId } }
    }

    default:
      return { success: false, error: `Unknown Slack action: ${action}` }
  }
}
