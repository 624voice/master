import { SHARED, TRADES, type ScenarioIndex, type TradeKey } from "./roiModel";

export type DriverResult = {
  label: string;
  monthlyUnits: number;
  annualValue: number;
};

export type RoiResult = {
  scenarioIndex: ScenarioIndex;
  drivers: {
    missedCallRecovery: DriverResult;
    noShowReduction: DriverResult;
    outboundSms: DriverResult;
    jobCloserUpsells: DriverResult;
    timeSavings: DriverResult;
  };
  totalAnnualBenefit: number;
  netAnnualROI: number;
  roiMultiple: number;
  paybackMonths: number | null;
};

function roundWhole(value: number): number {
  return Math.round(value);
}

export function computeRoi(
  trade: TradeKey,
  calls: number,
  scenarioIndex: ScenarioIndex,
): RoiResult {
  const t = TRADES[trade];
  const s = scenarioIndex;

  if (calls <= 0) {
    return {
      scenarioIndex,
      drivers: {
        missedCallRecovery: {
          label: "Missed-Call Recovery",
          monthlyUnits: 0,
          annualValue: 0,
        },
        noShowReduction: {
          label: "No-Show Reduction",
          monthlyUnits: 0,
          annualValue: 0,
        },
        outboundSms: {
          label: "Outbound SMS Campaigns",
          monthlyUnits: 0,
          annualValue: 0,
        },
        jobCloserUpsells: {
          label: "Job-Closer Upsells",
          monthlyUnits: 0,
          annualValue: 0,
        },
        timeSavings: {
          label: "Time Savings",
          monthlyUnits: SHARED.adminHoursSaved[s],
          annualValue: roundWhole(SHARED.adminHoursSaved[s] * SHARED.hourlyRate * 12),
        },
      },
      totalAnnualBenefit: roundWhole(
        SHARED.adminHoursSaved[s] * SHARED.hourlyRate * 12,
      ),
      netAnnualROI: roundWhole(
        SHARED.adminHoursSaved[s] * SHARED.hourlyRate * 12 - SHARED.annualInvestment,
      ),
      roiMultiple: roundWhole(
        (SHARED.adminHoursSaved[s] * SHARED.hourlyRate * 12 -
          SHARED.annualInvestment) /
          SHARED.annualInvestment,
      ),
      paybackMonths: null,
    };
  }

  const answeredRate = 1 - t.missedCallRate;

  const jobsRecoveredPerMonth =
    calls * t.missedCallRate * SHARED.recoveredBookingRate[s];
  const missedCallRecoveryAnnual = roundWhole(
    jobsRecoveredPerMonth * t.avgJobValue * 12,
  );

  const apptsSavedPerMonth =
    calls *
    answeredRate *
    t.baseBookingConv *
    t.noShowRate *
    SHARED.noShowReduction[s];
  const noShowReductionAnnual = roundWhole(
    apptsSavedPerMonth * t.avgJobValue * 12,
  );

  const campaignJobsPerMonth = t.campaignJobs[s];
  const outboundSmsAnnual = roundWhole(
    campaignJobsPerMonth * t.avgJobValue * 12,
  );

  const upsellJobsPerMonth =
    calls * answeredRate * t.baseBookingConv * SHARED.upsellRate[s];
  const jobCloserUpsellsAnnual = roundWhole(
    upsellJobsPerMonth * t.avgUpsellValue * 12,
  );

  const adminHoursPerMonth = SHARED.adminHoursSaved[s];
  const timeSavingsAnnual = roundWhole(
    adminHoursPerMonth * SHARED.hourlyRate * 12,
  );

  const totalAnnualBenefit = roundWhole(
    missedCallRecoveryAnnual +
      noShowReductionAnnual +
      outboundSmsAnnual +
      jobCloserUpsellsAnnual +
      timeSavingsAnnual,
  );

  const netAnnualROI = roundWhole(
    totalAnnualBenefit - SHARED.annualInvestment,
  );

  const roiMultiple = roundWhole(netAnnualROI / SHARED.annualInvestment);

  const paybackMonths =
    totalAnnualBenefit > 0
      ? roundWhole((SHARED.annualInvestment / totalAnnualBenefit) * 12 * 10) /
        10
      : null;

  return {
    scenarioIndex,
    drivers: {
      missedCallRecovery: {
        label: "Missed-Call Recovery",
        monthlyUnits: roundWhole(jobsRecoveredPerMonth * 10) / 10,
        annualValue: missedCallRecoveryAnnual,
      },
      noShowReduction: {
        label: "No-Show Reduction",
        monthlyUnits: roundWhole(apptsSavedPerMonth * 10) / 10,
        annualValue: noShowReductionAnnual,
      },
      outboundSms: {
        label: "Outbound SMS Campaigns",
        monthlyUnits: campaignJobsPerMonth,
        annualValue: outboundSmsAnnual,
      },
      jobCloserUpsells: {
        label: "Job-Closer Upsells",
        monthlyUnits: roundWhole(upsellJobsPerMonth * 10) / 10,
        annualValue: jobCloserUpsellsAnnual,
      },
      timeSavings: {
        label: "Time Savings",
        monthlyUnits: adminHoursPerMonth,
        annualValue: timeSavingsAnnual,
      },
    },
    totalAnnualBenefit,
    netAnnualROI,
    roiMultiple,
    paybackMonths,
  };
}

export function computeAllScenarios(
  trade: TradeKey,
  calls: number,
): RoiResult[] {
  return ([0, 1, 2] as ScenarioIndex[]).map((scenarioIndex) =>
    computeRoi(trade, calls, scenarioIndex),
  );
}
