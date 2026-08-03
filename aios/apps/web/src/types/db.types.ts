// Re-export role types so the frontend doesn't need to import from @aios/db directly
export type UserRole = 'STUDENT' | 'TEACHER' | 'ADMIN' | 'FOUNDER';
export type UserStatus = 'ACTIVE' | 'INACTIVE' | 'PENDING' | 'SUSPENDED';
