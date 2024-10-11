export interface UserType {
    id: number | null;
    username: string | null;
    email: string | null;
    isEmailVerified: boolean;
    hasConsented: boolean;
}