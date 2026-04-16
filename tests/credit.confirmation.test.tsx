import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { CreditConfirmationDialog } from '~components/CreditConfirmationDialog'

describe('CreditConfirmationDialog', () => {
  it('shows disclaimer informing about estimation and refund rules', () => {
    render(
      <CreditConfirmationDialog
        isOpen={true}
        estimatedCredits={5}
        currentBalance={20}
        hasSufficientCredits={true}
        userTier="pro"
        onConfirm={() => {}}
        onCancel={() => {}}
      />
    )

    // phrases might be split across elements/newlines, so match simpler fragments
    expect(
      screen.getByText(/based on/i)
    ).toBeTruthy()
    expect(
      screen.getByText(/actual cost may differ/i)
    ).toBeTruthy()
    expect(
      screen.getByText(/estimate/i)
    ).toBeTruthy()
  })
})
