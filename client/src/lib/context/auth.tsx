import {
  useLoginMutation,
  useLogoutMutation,
  type LoginIn,
} from "@/services/auth";
import { createContext, useContext, useState, useEffect } from "react";

interface AuthContextType {
  user: any;
  token: string | null;
  login: (input: LoginIn) => Promise<any>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<any>(null);
  const [token, setToken] = useState<string | null>(null);

  useEffect(() => {
    if (!user) {
      //fetch me
    }
  }, [user]);

  const login = async (input: LoginIn) => {
    await useLoginMutation().mutateAsync(input, {
      onSuccess: (data) => {
        setToken(data);
      },
    });
  };

  const logout = async () => {
    if (token) {
      await useLogoutMutation().mutateAsync(undefined, {
        onSuccess: () => {
          setToken(null);
          setUser(null);
        },
      });
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        login,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};
