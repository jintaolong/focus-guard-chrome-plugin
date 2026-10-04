import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { MendiPromoCard } from '~components/popup/MendiPromoCard'
import { PROMO_COPY } from '~lib/mendi-promo'

describe('MendiPromoCard', () => {
  it('renders the brief copy verbatim and both buttons', () => {
    render(<MendiPromoCard onTry={() => {}} onDismiss={() => {}} />)
    expect(screen.getByText('The engine behind this verdict now drafts replies on X.')).toBeInTheDocument()
    expect(
      screen.getByText(
        'Meet Mendi. He reads real comments before he writes, shows you the sources, and never posts for you. Six months of the Voice tier free for early users.'
      )
    ).toBeInTheDocument()
    expect(screen.getByRole('button', { name: PROMO_COPY.primary })).toHaveTextContent('Try Mendi')
    expect(screen.getByRole('button', { name: PROMO_COPY.secondary })).toHaveTextContent('Not now')
  })

  it('wires the two buttons to their handlers', () => {
    const onTry = vi.fn()
    const onDismiss = vi.fn()
    render(<MendiPromoCard onTry={onTry} onDismiss={onDismiss} />)
    fireEvent.click(screen.getByRole('button', { name: 'Try Mendi' }))
    fireEvent.click(screen.getByRole('button', { name: 'Not now' }))
    expect(onTry).toHaveBeenCalledTimes(1)
    expect(onDismiss).toHaveBeenCalledTimes(1)
  })
})
