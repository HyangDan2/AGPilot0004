import React, { createContext, useContext, useState, useEffect } from 'react';
import { Child } from '../types';
import { api } from '../services/api';
import { localStore } from '../services/localStore';
import { useAuth } from './AuthContext';

interface ChildContextType {
  childrenList: Child[];
  activeChild: Child | null;
  isLoading: boolean;
  setActiveChildId: (id: string) => void;
  refreshChildren: () => Promise<void>;
  createChild: (data: any) => Promise<Child>;
}

const ChildContext = createContext<ChildContextType | undefined>(undefined);

export const ChildProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const [childrenList, setChildrenList] = useState<Child[]>([]);
  const [activeChildId, setActiveChildIdState] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    loadChildren();
  }, [user]);

  const loadChildren = async () => {
    setIsLoading(true);
    try {
      // Local-first: always read localStorage baby profiles first
      let list = localStore.getChildren();

      if (user) {
        try {
          const remoteList = await api.getChildren();
          for (const rc of remoteList) {
            localStore.upsertChild(rc);
          }
          list = localStore.getChildren();
        } catch {
          // Offline or unauthenticated: rely on localStore
        }
      }

      if (list.length === 0) {
        const starter = localStore.upsertChild({
          name: '우리 아가 (별이)',
          birth_date: '2026-06-15',
          sex: 'female',
          is_premature: false,
        });
        list = [starter];
      }

      setChildrenList(list);

      const savedId = localStore.getActiveChildId() || localStorage.getItem('babycare_active_child_id');
      const found = list.find((c) => c.id === savedId);
      if (found) {
        setActiveChildIdState(found.id);
      } else if (list.length > 0) {
        setActiveChildIdState(list[0].id);
        localStore.setActiveChildId(list[0].id);
      }
    } finally {
      setIsLoading(false);
    }
  };

  const setActiveChildId = (id: string) => {
    setActiveChildIdState(id);
    localStore.setActiveChildId(id);
    localStorage.setItem('babycare_active_child_id', id);
  };

  const refreshChildren = async () => {
    await loadChildren();
  };

  const createChild = async (data: any): Promise<Child> => {
    let created = localStore.upsertChild(data);
    if (user) {
      try {
        const remote = await api.createChild(data);
        created = localStore.upsertChild(remote);
      } catch {
        // Keep local child if server create fails
      }
    }
    setChildrenList(localStore.getChildren());
    setActiveChildId(created.id);
    return created;
  };

  const activeChild = childrenList.find((c) => c.id === activeChildId) || childrenList[0] || null;

  return (
    <ChildContext.Provider
      value={{
        childrenList,
        activeChild,
        isLoading,
        setActiveChildId,
        refreshChildren,
        createChild,
      }}
    >
      {children}
    </ChildContext.Provider>
  );
};

export const useChild = () => {
  const context = useContext(ChildContext);
  if (!context) throw new Error('useChild must be used within a ChildProvider');
  return context;
};
