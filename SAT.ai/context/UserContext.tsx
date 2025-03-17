// contexts/UserContext.tsx
import React, { createContext, useState, useContext } from 'react';

interface UserContextType {
  profileImage: string | null;
  updateProfileImage: (uri: string) => void;
}

const UserContext = createContext<UserContextType>({
  profileImage: null,
  updateProfileImage: () => {},
});

export const UserProvider = ({ children }: { children: React.ReactNode }) => {
  const [profileImage, setProfileImage] = useState<string | null>(null);

  const updateProfileImage = (uri: string) => {
    setProfileImage(uri);
  };

  return (
    <UserContext.Provider value={{ profileImage, updateProfileImage }}>
      {children}
    </UserContext.Provider>
  );
};

export const useUser = () => useContext(UserContext);