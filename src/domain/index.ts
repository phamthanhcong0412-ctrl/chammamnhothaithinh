/**
 * DOMAIN LAYER BARREL EXPORT
 * Kiến trúc Clean Architecture: Tầng Domain hoàn toàn thuần khiết (Pure TypeScript),
 * không phụ thuộc vào UI Framework, Supabase Client hay Express Server.
 */

export * from './location/GeoLocationCalculator.ts';
export * from './network/WifiProfileParser.ts';
export * from './shifts/ShiftTimingEvaluator.ts';
export * from './salary/SalaryCalculator.ts';
export * from './attendance/TurnConsolidator.ts';
export * from './contracts/IAttendanceRepository.ts';
export * from './contracts/IUserRepository.ts';
export * from './contracts/IStoreConfigRepository.ts';
export * from './validators/CheckInValidators.ts';
