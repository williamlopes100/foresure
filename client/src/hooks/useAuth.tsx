import { createContext, useCallback, useContext, useState } from "react";

interface AuthUser {
    firstName?: string | null;
    lastName?: string | null;
    email?: string;
}

interface AuthContextValue {
    isAuthenticated: boolean;
    user: AuthUser | null;
    loading: boolean;
    logout: () => void;
    refreshAuth: () => void;
}

const checkAuthSync = () => {
    const token = localStorage.getItem('authToken');
    const userData = localStorage.getItem('user');

    if (token && userData) {
        try {
            const parsedUser = JSON.parse(userData);
            return { isAuthenticated: true, user: parsedUser };
        } catch {
            localStorage.removeItem('authToken');
            localStorage.removeItem('user');
            return { isAuthenticated: false, user: null };
        }
    }
    return { isAuthenticated: false, user: null };
};

const AuthContext = createContext<AuthContextValue | null>(null);

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
    const [authState, setAuthState] = useState(checkAuthSync);

    const logout = useCallback(() => {
        localStorage.removeItem('authToken');
        localStorage.removeItem('user');
        setAuthState({ isAuthenticated: false, user: null });
    }, []);

    const refreshAuth = useCallback(() => {
        setAuthState(checkAuthSync());
    }, []);

    return (
        <AuthContext.Provider value={{ ...authState, loading: false, logout, refreshAuth }}>
            {children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => {
    const context = useContext(AuthContext);
    if (!context) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
};
