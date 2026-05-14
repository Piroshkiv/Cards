import { describe, it, expect } from 'vitest'
import {
  WORD_RATINGS, ARTICLE_RATINGS,
  ACTIVE_THRESHOLD, ACTIVE_THRESHOLD_ARTICLE,
  MIN_ACTIVE, MIN_ACTIVE_ARTICLE,
  defaultProgress, introduceCard,
  applyWordGrade, applyQuizResult, applyArticleResult,
  cardWeight, isIntroduced, isActive, isActiveArticle,
} from '../progress'

// ─── defaultProgress / introduceCard ────────────────────────────────────────

describe('defaultProgress', () => {
  it('returns n=0 and last_seen_session=0', () => {
    const p = defaultProgress()
    expect(p.n).toBe(0)
    expect(p.last_seen_session).toBe(0)
  })
})

describe('introduceCard', () => {
  it('sets last_seen_session to currentSession', () => {
    const p = introduceCard(7)
    expect(p.n).toBe(0)
    expect(p.last_seen_session).toBe(7)
  })
})

// ─── isIntroduced / isActive ─────────────────────────────────────────────────

describe('isIntroduced', () => {
  it('returns false for lss=0', () => expect(isIntroduced({ n: 0, last_seen_session: 0 })).toBe(false))
  it('returns true for lss>0',  () => expect(isIntroduced({ n: 0, last_seen_session: 1 })).toBe(true))
})

describe('isActive', () => {
  it('returns false for unintroduced card', () =>
    expect(isActive({ n: 0, last_seen_session: 0 })).toBe(false))

  it('returns true for introduced card with n ≤ ACTIVE_THRESHOLD', () =>
    expect(isActive({ n: ACTIVE_THRESHOLD, last_seen_session: 1 })).toBe(true))

  it('returns false for introduced card with n > ACTIVE_THRESHOLD', () =>
    expect(isActive({ n: ACTIVE_THRESHOLD + 0.01, last_seen_session: 1 })).toBe(false))
})

// ─── applyWordGrade ──────────────────────────────────────────────────────────

describe('applyWordGrade', () => {
  const base = { n: 4, last_seen_session: 2 }
  const session = 5

  it('updates last_seen_session on every grade', () => {
    for (const g of [0, 1, 2, 3] as const) {
      expect(applyWordGrade(base, g, session).last_seen_session).toBe(session)
    }
  })

  it('hard (grade 0): n converges toward 0', () => {
    const { target, alpha } = WORD_RATINGS[0]
    expect(applyWordGrade(base, 0, session).n).toBeCloseTo(base.n * (1 - alpha) + target * alpha)
  })

  it('normal (grade 1): n moves toward 3', () => {
    const { target, alpha } = WORD_RATINGS[1]
    expect(applyWordGrade(base, 1, session).n).toBeCloseTo(base.n * (1 - alpha) + target * alpha)
  })

  it('easy (grade 2): n moves toward 6', () => {
    const { target, alpha } = WORD_RATINGS[2]
    expect(applyWordGrade(base, 2, session).n).toBeCloseTo(base.n * (1 - alpha) + target * alpha)
  })

  it('very easy (grade 3): n jumps toward 15', () => {
    const { target, alpha } = WORD_RATINGS[3]
    expect(applyWordGrade(base, 3, session).n).toBeCloseTo(base.n * (1 - alpha) + target * alpha)
  })

  it('hard on n=0 keeps n at 0', () => {
    expect(applyWordGrade({ n: 0, last_seen_session: 1 }, 0, session).n).toBe(0)
  })

  it('repeated hard answers keep n near 0', () => {
    let p = { n: 5, last_seen_session: 1 }
    for (let i = 0; i < 20; i++) p = applyWordGrade(p, 0, session)
    expect(p.n).toBeLessThan(0.01)
  })

  it('repeated very-easy answers converge n toward 15', () => {
    let p = { n: 0, last_seen_session: 1 }
    for (let i = 0; i < 50; i++) p = applyWordGrade(p, 3, session)
    expect(p.n).toBeGreaterThan(14)
  })
})

// ─── applyQuizResult ─────────────────────────────────────────────────────────

describe('applyQuizResult', () => {
  const base = { n: 3, last_seen_session: 1 }

  it('wrong maps to grade 0 (hard)', () => {
    const via_quiz  = applyQuizResult(base, false, 5)
    const via_grade = applyWordGrade(base, 0, 5)
    expect(via_quiz.n).toBeCloseTo(via_grade.n)
  })

  it('correct maps to grade 2 (easy)', () => {
    const via_quiz  = applyQuizResult(base, true, 5)
    const via_grade = applyWordGrade(base, 2, 5)
    expect(via_quiz.n).toBeCloseTo(via_grade.n)
  })
})

// ─── cardWeight ──────────────────────────────────────────────────────────────

describe('cardWeight', () => {
  it('new card (n=0, lss=session) has weight=1', () => {
    const p = { n: 0, last_seen_session: 3 }
    expect(cardWeight(p, 3, 50)).toBeCloseTo(1)
  })

  it('high n → lower weight than low n (same session gap)', () => {
    const session = 5
    const low  = cardWeight({ n: 1, last_seen_session: 5 }, session, 50)
    const high = cardWeight({ n: 8, last_seen_session: 5 }, session, 50)
    expect(low).toBeGreaterThan(high)
  })

  it('larger session gap → higher weight', () => {
    const n = 3
    const recent = cardWeight({ n, last_seen_session: 10 }, 10, 50)
    const old    = cardWeight({ n, last_seen_session: 5  }, 10, 50)
    expect(old).toBeGreaterThan(recent)
  })

  it('scale grows with deck size, reducing weight for high n', () => {
    const p = { n: 5, last_seen_session: 3 }
    const small = cardWeight(p, 3, 50)
    const large = cardWeight(p, 3, 5000)
    expect(large).toBeLessThan(small)
  })

  it('weight is always positive', () => {
    const cases = [
      { n: 0,  last_seen_session: 0  },
      { n: 15, last_seen_session: 1  },
      { n: 3,  last_seen_session: 10 },
    ]
    for (const p of cases) {
      expect(cardWeight(p, 20, 100)).toBeGreaterThan(0)
    }
  })

  it('scale=1 for deckSize ≤ 50', () => {
    // log10(10/50) < 0, so max(1, ...) = 1
    const p = { n: 2, last_seen_session: 3 }
    const w10  = cardWeight(p, 3, 10)
    const w50  = cardWeight(p, 3, 50)
    // Both should use scale=1
    expect(w10).toBeCloseTo(w50)
  })
})

// ─── Config sanity ────────────────────────────────────────────────────────────

describe('WORD_RATINGS config', () => {
  it('has 4 entries', () => expect(WORD_RATINGS).toHaveLength(4))

  it('targets are non-decreasing', () => {
    for (let i = 1; i < WORD_RATINGS.length; i++)
      expect(WORD_RATINGS[i].target).toBeGreaterThanOrEqual(WORD_RATINGS[i - 1].target)
  })

  it('alphas are in (0, 1)', () => {
    for (const r of WORD_RATINGS) {
      expect(r.alpha).toBeGreaterThan(0)
      expect(r.alpha).toBeLessThan(1)
    }
  })
})

describe('ARTICLE_RATINGS config', () => {
  it('has 2 entries', () => expect(ARTICLE_RATINGS).toHaveLength(2))

  it('alphas are in (0, 1)', () => {
    for (const r of ARTICLE_RATINGS) {
      expect(r.alpha).toBeGreaterThan(0)
      expect(r.alpha).toBeLessThan(1)
    }
  })
})

describe('isActiveArticle', () => {
  it('uses ACTIVE_THRESHOLD_ARTICLE not ACTIVE_THRESHOLD', () => {
    // n=2.56 is > ACTIVE_THRESHOLD(2) but ≤ ACTIVE_THRESHOLD_ARTICLE(3)
    const p = { n: 2.56, last_seen_session: 1 }
    expect(isActive(p)).toBe(false)
    expect(isActiveArticle(p)).toBe(true)
  })

  it('graduates after n > ACTIVE_THRESHOLD_ARTICLE', () => {
    const p = { n: ACTIVE_THRESHOLD_ARTICLE + 0.01, last_seen_session: 1 }
    expect(isActiveArticle(p)).toBe(false)
  })
})

// ─── Article mode progression simulation ─────────────────────────────────────
// target=4, alpha=0.4, ACTIVE_THRESHOLD_ARTICLE=3
// n: 0 → 1.6 → 2.56 → 3.14 (graduates on 3rd correct)

describe('article mode progression', () => {
  const session = 1

  it('correct 1: n=2.4, still active', () => {
    let p = { n: 0, last_seen_session: session }
    p = applyArticleResult(p, true, session)
    expect(p.n).toBeCloseTo(2.4)
    expect(isActiveArticle(p)).toBe(true)
  })

  it('correct 2: n=3.84, exits active pool (>3)', () => {
    let p = { n: 0, last_seen_session: session }
    p = applyArticleResult(p, true, session)
    p = applyArticleResult(p, true, session)
    expect(p.n).toBeCloseTo(3.84)
    expect(isActiveArticle(p)).toBe(false)
  })

  it('correct 3: n≈4.7, well above threshold', () => {
    let p = { n: 0, last_seen_session: session }
    for (let i = 0; i < 3; i++) p = applyArticleResult(p, true, session)
    expect(p.n).toBeCloseTo(4.704)
    expect(isActiveArticle(p)).toBe(false)
  })

  it('wrong resets n toward 0, stays active', () => {
    let p = { n: 0, last_seen_session: session }
    p = applyArticleResult(p, false, session)
    expect(p.n).toBeCloseTo(0)
    expect(isActiveArticle(p)).toBe(true)
  })

  it('wrong after 3 corrects re-activates card', () => {
    let p = { n: 0, last_seen_session: session }
    for (let i = 0; i < 3; i++) p = applyArticleResult(p, true, session)
    expect(isActiveArticle(p)).toBe(false)  // n=4.7, above threshold
    p = applyArticleResult(p, false, session)
    expect(p.n).toBeCloseTo(4.704 * 0.4)   // n drops to ~1.88
    expect(isActiveArticle(p)).toBe(true)   // re-activated
  })

  it('weight at n=4.7 is low (~0.196)', () => {
    // 3 corrects → n=4.7, weight = 2^(-4.7/2) ≈ 0.196
    const p = { n: 4.704, last_seen_session: session }
    const w = cardWeight(p, session, 340)
    expect(w).toBeGreaterThan(0.17)
    expect(w).toBeLessThan(0.22)
  })

  it('asymptote weight ≈ 0.125 (target=6)', () => {
    // converges to n=6: weight = 2^(-3) = 0.125
    let p = { n: 0, last_seen_session: session }
    for (let i = 0; i < 50; i++) p = applyArticleResult(p, true, session)
    expect(p.n).toBeCloseTo(6, 1)
    expect(cardWeight(p, session, 340)).toBeCloseTo(0.125, 1)
  })
})

describe('constants', () => {
  it('ACTIVE_THRESHOLD is 2',         () => expect(ACTIVE_THRESHOLD).toBe(2))
  it('ACTIVE_THRESHOLD_ARTICLE is 3', () => expect(ACTIVE_THRESHOLD_ARTICLE).toBe(3))
  it('MIN_ACTIVE is 8',               () => expect(MIN_ACTIVE).toBe(8))
  it('MIN_ACTIVE_ARTICLE is 8',       () => expect(MIN_ACTIVE_ARTICLE).toBe(8))
})
