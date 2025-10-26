import type { SavedPlan } from '../types';

// This is a simulated API service that uses localStorage but separates data by user.
// It's designed to be easily replaceable with a real backend API.

const getPlans = async (userId: string): Promise<SavedPlan[]> => {
  if (!userId) return [];
  try {
    const item = window.localStorage.getItem(`budget-plans-${userId}`);
    return item ? JSON.parse(item) : [];
  } catch (error) {
    console.error("Error reading from localStorage", error);
    return [];
  }
};

const savePlan = async (userId: string, newPlan: SavedPlan): Promise<SavedPlan[]> => {
  if (!userId) throw new Error("User not authenticated");
  const currentPlans = await getPlans(userId);
  const updatedPlans = [...currentPlans, newPlan];
  try {
    window.localStorage.setItem(`budget-plans-${userId}`, JSON.stringify(updatedPlans));
    return updatedPlans;
  } catch (error) {
    console.error("Error writing to localStorage", error);
    throw error;
  }
};

const updatePlan = async (userId: string, updatedPlan: SavedPlan): Promise<SavedPlan[]> => {
  if (!userId) throw new Error("User not authenticated");
  const currentPlans = await getPlans(userId);
  const updatedPlans = currentPlans.map(p => p.id === updatedPlan.id ? updatedPlan : p);
  try {
    window.localStorage.setItem(`budget-plans-${userId}`, JSON.stringify(updatedPlans));
    return updatedPlans;
  } catch (error) {
    console.error("Error writing to localStorage", error);
    throw error;
  }
};

const deletePlan = async (userId: string, planId: string): Promise<SavedPlan[]> => {
  if (!userId) throw new Error("User not authenticated");
  const currentPlans = await getPlans(userId);
  const updatedPlans = currentPlans.filter(plan => plan.id !== planId);
  try {
    window.localStorage.setItem(`budget-plans-${userId}`, JSON.stringify(updatedPlans));
    return updatedPlans;
  } catch (error) {
    console.error("Error writing to localStorage", error);
    throw error;
  }
};

export const apiService = {
  getPlans,
  savePlan,
  updatePlan,
  deletePlan,
};
