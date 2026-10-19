/**
 * The role of a user.
 * - admin: full access to the application.
 * - employee: access limited to the daily deliveries summary.
 */
export type UserRole = 'admin' | 'employee';

/**
 * The authenticated user profile returned by GET /auth/me.
 */
export type CurrentUser = {
  id: number;
  email: string;
  name: string;
  role: UserRole;
  is_active: boolean;
};

/** The landing page of each role. */
export const HOME_PATH_BY_ROLE: Record<UserRole, string> = {
  admin: '/home',
  employee: '/deliveries',
};

/** The only route an employee is allowed to open. */
export const EMPLOYEE_ALLOWED_PATHS = ['/deliveries'] as const;
