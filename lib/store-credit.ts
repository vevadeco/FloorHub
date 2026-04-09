export interface RestockingFeeResult {
  restockingFee: number
  netRefund: number
}

/**
 * Calculate the restocking fee and net refund for a return.
 * Pure function with no side effects.
 *
 * @param refundAmount - The total refund amount before restocking fee
 * @param restockingPercentage - The restocking charge percentage (0–100)
 * @param waive - Whether to waive the restocking fee entirely
 * @returns An object with restockingFee and netRefund, both rounded to 2 decimal places
 */
export function calculateRestockingFee(
  refundAmount: number,
  restockingPercentage: number,
  waive: boolean
): RestockingFeeResult {
  if (waive) {
    return {
      restockingFee: 0,
      netRefund: Math.round(refundAmount * 100) / 100,
    }
  }

  const restockingFee = Math.round(refundAmount * (restockingPercentage / 100) * 100) / 100
  const netRefund = Math.round((refundAmount - restockingFee) * 100) / 100

  return { restockingFee, netRefund }
}
