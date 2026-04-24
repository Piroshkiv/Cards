import { useState, useRef, useEffect, useCallback } from 'react'
import { Plus, Upload, Users, User, RefreshCw } from 'lucide-react'
import { getPacks, savePacks, savePack, deletePack, getUsername, saveUsername, getSyncQueue, getMyPackIds, initMyPackIds, addToMyPackIds } from '../utils/storage'
import { parseCSV } from '../utils/csv'
import { syncAll, fetchAllPacks, subscribeToPack, unsubscribeFromPack } from '../utils/sync'
import { PackCard } from '../components/PackCard'
import { Modal } from '../components/Modal'
import { Button } from '../components/Button'
import type { Pack } from '../types'

type SyncStatus = 'idle' | 'syncing' | 'done' | 'offline'

interface RemotePackSummary {
  id: string
  name: string
  version: number
  updated_at: string
  owners: string[]
  card_count: number
}

export function Home() {
  const [packs, setPacks] = useState<Pack[]>(() => getPacks())
  const [myPackIds, setMyPackIds] = useState<Set<string>>(() => {
    const existing = getPacks().map(p => p.id)
    initMyPackIds(existing)
    return getMyPackIds() ?? new Set(existing)
  })
  const [username, setUsername] = useState<string | null>(() => getUsername())
  const [showUsernameModal, setShowUsernameModal] = useState(() => !getUsername())
  const [usernameInput, setUsernameInput] = useState('')
  const [showAddModal, setShowAddModal] = useState(false)
  const [newPackName, setNewPackName] = useState('')
  const [csvError, setCsvError] = useState<string | null>(null)
  const [csvSuccess, setCsvSuccess] = useState<string | null>(null)
  const [syncStatus, setSyncStatus] = useState<SyncStatus>('idle')
  const [showBrowseModal, setShowBrowseModal] = useState(false)
  const [remotePacks, setRemotePacks] = useState<RemotePackSummary[]>([])
  const [browseLoading, setBrowseLoading] = useState(false)
  const [browseError, setBrowseError] = useState<string | null>(null)
  const [subscribingId, setSubscribingId] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  const runSync = useCallback(async (name: string) => {
    setSyncStatus('syncing')
    try {
      await syncAll(name)
      setSyncStatus('done')
      setPacks(getPacks())
    } catch {
      setSyncStatus('offline')
    }
  }, [])

  // Auto-sync on mount
  useEffect(() => {
    const name = getUsername()
    if (name) runSync(name)
  }, [runSync])

  function handleSaveUsername() {
    const name = usernameInput.trim()
    if (!name) return
    saveUsername(name)
    setUsername(name)
    setUsernameInput('')
    setShowUsernameModal(false)
    runSync(name)
  }

  function handleManualSync() {
    if (!username) { setShowUsernameModal(true); return }
    runSync(username)
  }

  function handleAddPack() {
    const name = newPackName.trim()
    if (!name) return
    const now = new Date().toISOString()
    const pack: Pack = {
      id: crypto.randomUUID(),
      name,
      cards: [],
      createdAt: now,
      updatedAt: now,
      version: 1,
    }
    savePack(pack)
    addToMyPackIds(pack.id)
    setMyPackIds(prev => new Set([...prev, pack.id]))
    setPacks(getPacks())
    setNewPackName('')
    setShowAddModal(false)
    if (username) runSync(username)
  }

  function handleDeletePack(id: string) {
    if (!confirm('Удалить пак и все его карточки?')) return
    deletePack(id)
    setPacks(getPacks())
  }

  async function handleUnsubscribe(id: string) {
    if (!confirm('Отписаться от пака?')) return
    await unsubscribeFromPack(id, username ?? '')
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
      const before = new Set(getPacks().map(p => p.id))
      const { packs: newPacks, result } = parseCSV(text, getPacks())
      savePacks(newPacks)
      const newIds = newPacks.filter(p => !before.has(p.id)).map(p => p.id)
      newIds.forEach(addToMyPackIds)
      if (newIds.length) setMyPackIds(prev => new Set([...prev, ...newIds]))
      setPacks(getPacks())

      if (result.errors.length > 0) {
        setCsvError(result.errors.slice(0, 3).join(' | '))
      } else {
        const parts: string[] = []
        if (result.created.length > 0) parts.push(`Создано паков: ${result.created.length}`)
        if (result.updated.length > 0) parts.push(`Обновлено паков: ${result.updated.length}`)
        parts.push(`Добавлено слов: ${result.added}`)
        setCsvSuccess(parts.join(' · '))
        if (username) runSync(username)
      }
    }
    reader.readAsText(file, 'utf-8')
    e.target.value = ''
  }

  async function handleOpenBrowse() {
    setShowBrowseModal(true)
    setBrowseLoading(true)
    setBrowseError(null)
    try {
      const list = await fetchAllPacks()
      setRemotePacks(list)
    } catch {
      setBrowseError('Не удалось загрузить список. Проверьте подключение.')
    } finally {
      setBrowseLoading(false)
    }
  }

  async function handleSubscribe(packId: string) {
    if (!username) { setShowUsernameModal(true); return }
    setSubscribingId(packId)
    try {
      await subscribeToPack(packId, username)
      setPacks(getPacks())
      // Refresh owners in browse list
      setRemotePacks(prev => prev.map(p =>
        p.id === packId ? { ...p, owners: [...p.owners, username] } : p
      ))
    } finally {
      setSubscribingId(null)
    }
  }

  const totalWords = packs.reduce((s, p) => s + p.cards.length, 0)
  const localPackIds = new Set(packs.map(p => p.id))
  const pendingCount = getSyncQueue().length

  return (
    <div className="page">
      <div className="page-header">
        <h1>Карточки</h1>
        <div className="page-header__sync">
          {syncStatus === 'syncing' && <span className="sync-dot sync-dot--syncing" title="Синхронизация..." />}
          {syncStatus === 'done' && <span className="sync-dot sync-dot--done" title="Синхронизировано" />}
          {syncStatus === 'offline' && <span className="sync-dot sync-dot--offline" title="Офлайн" />}
          {pendingCount > 0 && <span className="sync-pending" title={`${pendingCount} ожидает отправки`}>{pendingCount}</span>}
        </div>
        <Button variant="ghost" size="sm" onClick={handleManualSync} title="Синхронизировать">
          <RefreshCw size={15} />
        </Button>
        <Button variant="ghost" size="sm" onClick={handleOpenBrowse}>
          <Users size={16} />
          Чужие паки
        </Button>
        <Button variant="ghost" size="sm" onClick={() => fileRef.current?.click()}>
          <Upload size={16} />
          CSV
        </Button>
        <Button size="sm" onClick={() => setShowAddModal(true)}>
          <Plus size={16} />
          Новый пак
        </Button>
        <button
          className="username-btn"
          onClick={() => { setUsernameInput(username ?? ''); setShowUsernameModal(true) }}
          title="Имя пользователя"
        >
          <User size={15} />
          {username ?? 'Войти'}
        </button>
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
              isOwner={myPackIds.has(pack.id)}
              onDelete={handleDeletePack}
              onUnsubscribe={handleUnsubscribe}
            />
          ))
        )}
      </div>

      {/* Username modal */}
      {showUsernameModal && (
        <Modal
          title={username ? 'Изменить имя' : 'Привет! Введите имя'}
          onClose={() => setShowUsernameModal(false)}
        >
          <div className="modal-form">
            <input
              className="input"
              type="text"
              placeholder="Ваше имя"
              value={usernameInput}
              onChange={e => setUsernameInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleSaveUsername()}
              autoFocus
            />
            <div className="modal-form__actions">
              <Button variant="secondary" onClick={() => setShowUsernameModal(false)}>
                Отмена
              </Button>
              <Button onClick={handleSaveUsername} disabled={!usernameInput.trim()}>
                Сохранить
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {/* New pack modal */}
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

      {/* Browse packs modal */}
      {showBrowseModal && (
        <Modal title="Все паки" onClose={() => setShowBrowseModal(false)}>
          <div className="browse-packs">
            {browseLoading && <p className="browse-packs__loading">Загрузка...</p>}
            {browseError && <p className="browse-packs__error">{browseError}</p>}
            {!browseLoading && !browseError && remotePacks.length === 0 && (
              <p className="browse-packs__empty">Паков пока нет</p>
            )}
            {!browseLoading && remotePacks.map(rp => {
              const alreadyHave = localPackIds.has(rp.id)
              return (
                <div key={rp.id} className="browse-pack-row">
                  <div className="browse-pack-row__info">
                    <span className="browse-pack-row__name">{rp.name}</span>
                    <span className="browse-pack-row__meta">
                      {rp.card_count} слов · {rp.owners.join(', ')}
                    </span>
                  </div>
                  <Button
                    size="sm"
                    variant={alreadyHave ? 'secondary' : 'primary'}
                    disabled={alreadyHave || subscribingId === rp.id}
                    onClick={() => handleSubscribe(rp.id)}
                  >
                    {subscribingId === rp.id ? '...' : alreadyHave ? 'Подписан' : 'Скопировать'}
                  </Button>
                </div>
              )
            })}
          </div>
        </Modal>
      )}
    </div>
  )
}
