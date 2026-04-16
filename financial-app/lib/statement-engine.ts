// Statement Engine — ported from Python statement_engine.py
// TODO: move to shared — canonical algorithm spec in shared/README.md
// Cross-language duplicate: financial-tool/models/statement_engine.py

export interface YearRecord {
  year: number
  cash: number
  investments: number
  realEstate: number
  otherAssets: number
  totalAssets: number
  liabilities: number
  netWorth: number
  annualIncome: number
  investmentIncome: number
  totalIncome: number
  annualExpenses: number
  netIncome: number
  savingsRate: number
  debtToAssets: number
}

export function generateStatements(params: {
  cash: number
  investments: number
  realEstate: number
  otherAssets: number
  liabilities: number
  monthlyIncome: number
  monthlyExpenses: number
  investmentReturn: number
  realEstateGrowth: number
  incomeGrowth: number
  expenseGrowth: number
  liabilityPaydown: number
  years: number
}): YearRecord[] {
  let { cash, investments, realEstate, otherAssets, liabilities,
        monthlyIncome, monthlyExpenses } = params
  const { investmentReturn, realEstateGrowth, incomeGrowth, expenseGrowth, liabilityPaydown, years } = params

  const records: YearRecord[] = []

  for (let year = 0; year <= years; year++) {
    const totalAssets = cash + investments + realEstate + otherAssets
    const netWorth = totalAssets - liabilities
    const annualIncome = monthlyIncome * 12
    const annualExpenses = monthlyExpenses * 12
    const investmentIncome = investments * investmentReturn
    const netIncome = annualIncome - annualExpenses + investmentIncome

    records.push({
      year,
      cash:              Math.round(cash),
      investments:       Math.round(investments),
      realEstate:        Math.round(realEstate),
      otherAssets:       Math.round(otherAssets),
      totalAssets:       Math.round(totalAssets),
      liabilities:       Math.round(liabilities),
      netWorth:          Math.round(netWorth),
      annualIncome:      Math.round(annualIncome),
      investmentIncome:  Math.round(investmentIncome),
      totalIncome:       Math.round(annualIncome + investmentIncome),
      annualExpenses:    Math.round(annualExpenses),
      netIncome:         Math.round(netIncome),
      savingsRate:       annualIncome > 0 ? Math.round((annualIncome - annualExpenses) / annualIncome * 1000) / 10 : 0,
      debtToAssets:      totalAssets > 0 ? Math.round(liabilities / totalAssets * 1000) / 10 : 0,
    })

    // Advance one year
    cash = Math.max(0, cash + annualIncome - annualExpenses)   // salary surplus only
    investments *= 1 + investmentReturn                         // compound in portfolio
    realEstate  *= 1 + realEstateGrowth
    liabilities  = Math.max(0, liabilities - liabilityPaydown)
    monthlyIncome   *= 1 + incomeGrowth
    monthlyExpenses *= 1 + expenseGrowth
  }

  return records
}
