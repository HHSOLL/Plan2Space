"use client";

import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

export interface Project {
  id: string;
  name: string;
  description: string | null;
  thumbnail?: string;
  created_at: string;
  updated_at: string;
  metadata?: Record<string, unknown>;
}

type ProjectState = {
  projects: Project[];
  currentProject: Project | null;
  isLoading: boolean;
  error: string | null;
  loadProjects: () => Promise<void>;
  createProject: (data: {
    name: string;
    description?: string | null;
    thumbnail?: string;
    metadata?: Record<string, unknown>;
  }) => Promise<Project>;
  updateProject: (id: string, data: { name?: string; description?: string | null }) => Promise<void>;
  deleteProject: (id: string) => Promise<void>;
  selectProject: (projectId: string | null) => void;
};

export const useProjectStore = create<ProjectState>()(
  persist(
    (set, get) => ({
      projects: [],
      currentProject: null,
      isLoading: false,
      error: null,
      loadProjects: async () => {
        set({ isLoading: true, error: null });
        try {
          await new Promise((r) => setTimeout(r, 400));
          set({ isLoading: false });
        } catch {
          set({ error: "Failed to load projects", isLoading: false });
        }
      },
      createProject: async (payload) => {
        set({ isLoading: true, error: null });
        const id =
          typeof crypto !== "undefined" && "randomUUID" in crypto
            ? crypto.randomUUID()
            : `project-${Math.random().toString(36).slice(2, 10)}`;
        const newProject: Project = {
          id,
          name: payload.name,
          thumbnail: payload.thumbnail,
          description: payload.description ?? null,
          metadata: payload.metadata,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        };
        await new Promise((r) => setTimeout(r, 1500));
        set((state) => ({
          projects: [newProject, ...state.projects],
          currentProject: newProject,
          isLoading: false
        }));
        return newProject;
      },
      updateProject: async (id, payload) => {
        set({ isLoading: true, error: null });
        await new Promise((r) => setTimeout(r, 500));
        set((state) => ({
          projects: state.projects.map((project) =>
            project.id === id ? { ...project, ...payload, updated_at: new Date().toISOString() } : project
          ),
          isLoading: false
        }));
      },
      deleteProject: async (id) => {
        set({ isLoading: true, error: null });
        await new Promise((r) => setTimeout(r, 500));
        set((state) => ({
          projects: state.projects.filter((project) => project.id !== id),
          isLoading: false
        }));
      },
      selectProject: (projectId) =>
        set((state) => ({
          currentProject: projectId ? state.projects.find((project) => project.id === projectId) ?? null : null
        }))
    }),
    {
      name: "plan2space-projects",
      storage: createJSONStorage(() => localStorage)
    }
  )
);
