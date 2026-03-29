import { defineStore } from 'pinia'
import { ref } from 'vue'
import { apiJson } from '../boot/api'

export type BandMember = {
  id: string
  name: string
  email: string
  image?: string | null
  role: string
  sortOrder: number
  isHidden: boolean
  beerCount: number
  joinedAt: string
}

export const useBandStore = defineStore('band', () => {
  const members = ref<BandMember[]>([])
  const loading = ref(false)

  async function fetchMembers() {
    loading.value = true
    try {
      members.value = await apiJson<BandMember[]>('/users')
    } finally {
      loading.value = false
    }
  }

  async function updateMember(userId: string, data: Partial<BandMember>) {
    const updated = await apiJson<BandMember>(`/users/${userId}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    })
    const idx = members.value.findIndex((m) => m.id === userId)
    if (idx !== -1) members.value[idx] = updated
    return updated
  }

  async function incrementBeer(userId: string) {
    const member = members.value.find((m) => m.id === userId)
    if (!member) return
    return updateMember(userId, { beerCount: member.beerCount + 1 })
  }

  return { members, loading, fetchMembers, updateMember, incrementBeer }
})
