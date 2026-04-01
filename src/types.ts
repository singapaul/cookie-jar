export interface Topic {
  id: number
  title: string
  description: string | null
  category: string | null
  url: string | null
  status: 'pending' | 'sent' | 'reviewed' | 'skipped' | 'archived'
  skip_count: number
  created_at: string
  sent_at: string | null
}

export interface Review {
  id: number
  topic_id: number
  pros: string | null
  cons: string | null
  rating: number
  verdict: string | null
  reviewed_at: string
}

export interface ConversationState {
  id: 1
  topic_id: number | null
  step: 'idle' | 'awaiting_pros' | 'awaiting_cons' | 'awaiting_rating' | 'awaiting_verdict'
  draft_pros: string | null
  draft_cons: string | null
  draft_rating: number | null
  updated_at: string | null
}

export interface InlineKeyboardButton { text: string; callback_data: string }
export interface MessageOptions {
  parse_mode?: 'HTML'
  reply_markup?: { inline_keyboard: InlineKeyboardButton[][] }
}
export type SendMessage = (chatId: string, text: string, options?: MessageOptions) => Promise<unknown>
