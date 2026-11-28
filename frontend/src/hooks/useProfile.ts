import { createContext, useContext } from 'react'
import type { Profile } from '../services/auth'

export const ProfileContext = createContext<Profile | null>(null)
export const useProfile = () => useContext(ProfileContext)
