import { useState, useRef } from 'react'
import { Plus, Upload } from 'lucide-react'
import { getPacks, savePacks, savePack, deletePack } from '../utils/storage'
import { parseCSV } from '../utils/csv'
import { PackCard } from '../components/PackCard'
import { Modal } from '../components/Modal'
import { Button } from '../components/Button'
import type { Pack } from '../types'

export function Home() {
  const [packs, setPacks] = useState<Pack[]>(() => getPacks())
  const [showAddModal, setShowAddModal] = useState(false)
  const [newPackName, setNewPackName] = useState('')
  const [csvError, setCsvError] = useState<string | null>(null)
  const [csvSuccess, setCsvSuccess] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  function handleAddPack() {
    const name = newPackName.trim()
    if (!name) return
    const pack: Pack = {
      id: crypto.randomUUID(),
      name,
      cards: [],
      createdAt: new Date().toISOString(),
    }
    savePack(pack)
    setPacks(getPacks())
    setNewPackName('')
    setShowAddModal(false)
  }

  function handleDeletePack(id: string) {
    if (!confirm('Удалить пак и все его карточки?')) return
    deletePack(id)
    setPacks(getPacks())
  }

  function handleCSV(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setCsvError(null)
    setCsvSuccess(null)

    const reader = new FileReader()
    reader.onload = ev => {
      const text = ev.target?.result as string
      const { packs: newPacks, result } = parseCSV(text, getPacks())
      savePacks(newPacks)
      setPacks(getPacks())

      if (result.errors.length > 0) {
        setCsvError(result.errors.slice(0, 3).join(' | '))
      } else {
        const parts: string[] = []
        if (result.created.length > 0) parts.push(`Создано паков: ${result.created.length}`)
        if (result.updated.length > 0) parts.push(`Обновлено паков: ${result.updated.length}`)
        parts.push(`Добавлено слов: ${result.added}`)
        setCsvSuccess(parts.join(' · '))
      }
    }
    reader.readAsText(file, 'utf-8')
    e.target.value = ''
  }

  const totalWords = packs.reduce((s, p) => s + p.cards.length, 0)

  return (
    <div className="page">
      <div className="page-header">
        <h1>Карточки</h1>
        <Button variant="ghost" size="sm" onClick={() => fileRef.current?.click()}>
          <Upload size={16} />
          CSV
        </Button>
        <Button size="sm" onClick={() => setShowAddModal(true)}>
          <Plus size={16} />
          Новый пак
        </Button>
        <input
          ref={fileRef}
          type="file"
          accept=".csv,text/csv"
          style={{ display: 'none' }}
          onChange={handleCSV}
        />
      </div>

      {totalWords > 0 && (
        <div className="stats-bar card">
          <div className="stats-bar__item">
            <span className="stats-bar__value">{totalWords}</span>
            <span className="stats-bar__label">слов всего</span>
          </div>
          <div className="stats-bar__item">
            <span className="stats-bar__value">{packs.length}</span>
            <span className="stats-bar__label">паков</span>
          </div>
        </div>
      )}

      {csvError && <div className="alert alert--error">{csvError}</div>}
      {csvSuccess && <div className="alert alert--success">{csvSuccess}</div>}

      <div className="pack-list">
        {packs.length === 0 ? (
          <div className="empty-state">
            <h3>Нет паков</h3>
            <p>Создайте первый пак или импортируйте CSV</p>
          </div>
        ) : (
          packs.map(pack => (
            <PackCard
              key={pack.id}
              pack={pack}
              onDelete={handleDeletePack}
            />
          ))
        )}
      </div>

      {showAddModal && (
        <Modal title="Новый пак" onClose={() => setShowAddModal(false)}>
          <div className="modal-form">
            <input
              className="input"
              type="text"
              placeholder="Название пака"
              value={newPackName}
              onChange={e => setNewPackName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleAddPack()}
              autoFocus
            />
            <div className="modal-form__actions">
              <Button variant="secondary" onClick={() => setShowAddModal(false)}>
                Отмена
              </Button>
              <Button onClick={handleAddPack} disabled={!newPackName.trim()}>
                Создать
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  )
}
