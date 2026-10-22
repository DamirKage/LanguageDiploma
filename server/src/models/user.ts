import { Schema, model, type InferSchemaType, type HydratedDocument, Types } from 'mongoose';
import { CEFR_LEVELS, LEARNING_GOALS, ROLES } from '@slog/shared';

const userSchema = new Schema(
  {
    email: { type: String, required: true, unique: true, lowercase: true, trim: true, maxlength: 254 },
    passwordHash: { type: String, required: true, select: false },
    name: { type: String, required: true, trim: true, maxlength: 80 },
    role: { type: String, enum: ROLES, default: 'user', index: true },
    isBlocked: { type: Boolean, default: false },
    /** Accounts created by the seed script for demonstrations. */
    isDemo: { type: Boolean, default: false },
    uiLocale: { type: String, default: 'ru' },
    timezone: { type: String, default: 'Asia/Almaty' },
    dailyMinutes: { type: Number, default: 15, min: 5, max: 120 },
    goals: { type: [String], enum: LEARNING_GOALS, default: [] },
    activeLanguage: { type: String, default: null },
    onboarded: { type: Boolean, default: false },
    lastActiveAt: { type: Date, default: null },
  },
  { timestamps: true },
);

export const User = model('User', userSchema);
export type UserDoc = HydratedDocument<InferSchemaType<typeof userSchema>>;

const enrollmentSchema = new Schema(
  {
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    language: { type: String, required: true },
    level: { type: String, enum: CEFR_LEVELS, default: 'A1' },
    placementLevel: { type: String, enum: [...CEFR_LEVELS, null], default: null },
    placementAt: { type: Date, default: null },
    placementSkipped: { type: Boolean, default: false },
    lastActivityAt: { type: Date, default: null },
  },
  { timestamps: true },
);
enrollmentSchema.index({ user: 1, language: 1 }, { unique: true });

export const Enrollment = model('Enrollment', enrollmentSchema);

const refreshTokenSchema = new Schema(
  {
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    tokenHash: { type: String, required: true, unique: true },
    family: { type: String, required: true, index: true },
    expiresAt: { type: Date, required: true },
    usedAt: { type: Date, default: null },
    revokedAt: { type: Date, default: null },
    userAgent: { type: String, maxlength: 300 },
  },
  { timestamps: true },
);
refreshTokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export const RefreshToken = model('RefreshToken', refreshTokenSchema);

const passwordResetSchema = new Schema(
  {
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    tokenHash: { type: String, required: true, unique: true },
    expiresAt: { type: Date, required: true },
    usedAt: { type: Date, default: null },
  },
  { timestamps: true },
);
passwordResetSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export const PasswordResetToken = model('PasswordResetToken', passwordResetSchema);

export type ObjectIdLike = Types.ObjectId | string;
