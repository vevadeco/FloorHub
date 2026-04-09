import { describe, it, expect } from 'vitest'
import { calculateRestockingFee } from '@/lib/store-credit'

describe('calculateRestockingFee', () => {
  it('calculates restocking fee with default 20% rate', () => {
    const result = calculateRestockingFee(100, 20, false)
    expect(result.restockingFee).toBe(20)
    expect(result.netRefund).toBe(80)
  })

  it('waives restocking fee when waive is true', () => {
    const result = calculateRestockingFee(100, 20, true)
    expect(result.restockingFee).toBe(0)
    expect(result.netRefund).toBe(100)
  })

  it('handles 0% restocking rate', () => {
    const result = calculateRestockingFee(250, 0, false)
    expect(result.restockingFee).toBe(0)
    expect(result.netRefund).toBe(250)
  })

  it('handles 100% restocking rate', () => {
    const result = calculateRestockingFee(250, 100, false)
    expect(result.restockingFee).toBe(250)
    expect(result.netRefund).toBe(0)
  })

  it('rounds to 2 decimal places', () => {
    // 33.33 * 15 / 100 = 4.9995 → should round to 5.00
    const result = calculateRestockingFee(33.33, 15, false)
    expect(result.restockingFee).toBe(5)
    expect(result.netRefund).toBe(28.33)
  })

  it('handles zero refund amount', () => {
    const result = calculateRestockingFee(0, 20, false)
    expect(result.restockingFee).toBe(0)
    expect(result.netRefund).toBe(0)
  })

  it('waive flag overrides any restocking percentage', () => {
    const result = calculateRestockingFee(500, 50, true)
    expect(result.restockingFee).toBe(0)
    expect(result.netRefund).toBe(500)
  })

  it('restockingFee + netRefund equals refundAmount', () => {
    const result = calculateRestockingFee(199.99, 15, false)
    expect(result.restockingFee + result.netRefund).toBeCloseTo(199.99, 2)
  })
})
