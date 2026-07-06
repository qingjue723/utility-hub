import { MapPin } from '@phosphor-icons/react'
import { useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { useLocale } from '../../app/providers/LocaleProvider'
import { CopyButton } from '../../components/CopyButton'
import { Panel } from '../../components/Panel'
import { usePersistentState } from '../../hooks/usePersistentState'
import { randomInt, randomItem } from '../../lib/random'
import { defaultPasswordOptions, generatePassword } from '../security/passwordCore'
import { usCompanyProfiles, usFirstNames, usJobTitlesByCategory, usLastNames } from './us-profile-data.generated'
import { realUsAddresses, usStates } from './us-addresses.generated'
import type { RealUsAddress } from './us-addresses.generated'

type EmailDomain = 'random' | 'gmail.com' | 'outlook.com' | 'yahoo.com' | 'proton.me' | 'icloud.com'
type UiLanguage = 'zh' | 'en'
type CompanyCategory = (typeof usCompanyProfiles)[number]['category']
type JobCategory = keyof typeof usJobTitlesByCategory

type AddressToolState = {
  state: string
  emailDomain: EmailDomain
  includeCoordinates: boolean
}

type Profile = {
  firstName: string
  lastName: string
  fullName: string
  gender: string
  birthday: string
  age: string
  username: string
  email: string
  password: string
  phone: string
  company: string
  jobTitle: string
  address: RealUsAddress
  fullAddress: string
  address2: string
}

const genders = ['Female', 'Male']
const emailDomains: readonly EmailDomain[] = ['random', 'gmail.com', 'outlook.com', 'yahoo.com', 'proton.me', 'icloud.com']
const concreteEmailDomains = emailDomains.filter((domain) => domain !== 'random')
const companyJobCategories: Record<CompanyCategory, readonly JobCategory[]> = {
  tech: ['tech', 'business', 'operations', 'marketing', 'sales', 'design', 'admin'],
  retail: ['operations', 'marketing', 'sales', 'business', 'admin', 'design', 'tech'],
  media: ['design', 'marketing', 'business', 'operations', 'sales', 'admin', 'tech'],
  education: ['education', 'admin', 'operations', 'tech', 'business'],
  industrial: ['engineering', 'operations', 'business', 'admin', 'sales', 'tech'],
  generic: ['business', 'operations', 'admin', 'marketing', 'sales', 'tech', 'design'],
}
const taxFreeStates = ['AK', 'DE', 'MT', 'NH', 'OR'] as const
const stateNames: Record<string, { en: string; zh: string }> = {
  AK: { en: 'Alaska', zh: '阿拉斯加' }, CA: { en: 'California', zh: '加利福尼亚' }, CO: { en: 'Colorado', zh: '科罗拉多' }, DC: { en: 'District of Columbia', zh: '哥伦比亚特区' },
  DE: { en: 'Delaware', zh: '特拉华' }, FL: { en: 'Florida', zh: '佛罗里达' }, GA: { en: 'Georgia', zh: '佐治亚' }, IL: { en: 'Illinois', zh: '伊利诺伊' },
  MA: { en: 'Massachusetts', zh: '马萨诸塞' }, MI: { en: 'Michigan', zh: '密歇根' }, MN: { en: 'Minnesota', zh: '明尼苏达' }, MT: { en: 'Montana', zh: '蒙大拿' },
  NC: { en: 'North Carolina', zh: '北卡罗来纳' }, NE: { en: 'Nebraska', zh: '内布拉斯加' }, NH: { en: 'New Hampshire', zh: '新罕布什尔' }, NY: { en: 'New York', zh: '纽约' },
  OR: { en: 'Oregon', zh: '俄勒冈' }, PA: { en: 'Pennsylvania', zh: '宾夕法尼亚' }, RI: { en: 'Rhode Island', zh: '罗德岛' }, TX: { en: 'Texas', zh: '得克萨斯' },
  WA: { en: 'Washington', zh: '华盛顿' },
}
const labels = {
  zh: {
    settings: '设置', state: '州', randomState: '随机州', taxFreeGroup: '推荐免税州', otherGroup: '其他州', emailDomain: '邮箱域名', randomDomain: '随机域名',
    coordinates: '显示经纬度', generate: '生成', source: '数据源', sourceText: '地址来自本地真实美国地址池；姓名、账号、电话、公司等为合成信息。',
    result: '生成结果', kicker: '美国注册资料', sourcePill: '真实地址', identity: '身份', account: '账号', address: '地址', empty: '未包含', maps: 'Google 地图验证',
    fullName: '姓名 / Full name', firstName: '名 / First name', lastName: '姓 / Last name', gender: '性别 / Gender', birthday: '生日 / Birthday', age: '年龄 / Age', phone: '电话 / Phone', email: '邮箱 / Email', username: '用户名 / Username',
    password: '密码 / Password', company: '公司 / Company', jobTitle: '职位 / Job title', street: '街道地址 / Street address', address2: '地址 2 / Address line 2', address2Empty: '无', city: '城市 / City', stateField: '州 / State', zip: '邮编 / ZIP code', country: '国家 / Country',
    fullAddress: '完整地址 / Full address', latitude: '纬度 / Latitude', longitude: '经度 / Longitude', sourceField: '来源 / Source', sourceValue: '本地真实美国地址池，个人信息为合成数据',
  },
  en: {
    settings: 'Settings', state: 'State', randomState: 'Random state', taxFreeGroup: 'Recommended no sales tax states', otherGroup: 'Other states', emailDomain: 'Email domain', randomDomain: 'Random domain',
    coordinates: 'Show coordinates', generate: 'Generate', source: 'Source', sourceText: 'Uses a local real US address pool. Name, account, phone, and company fields are synthetic.',
    result: 'Generated profile', kicker: 'United States registration profile', sourcePill: 'Real address', identity: 'Identity', account: 'Account', address: 'Address', empty: 'Not included', maps: 'Verify on Google Maps',
    fullName: 'Full name / 姓名', firstName: 'First name / 名', lastName: 'Last name / 姓', gender: 'Gender / 性别', birthday: 'Birthday / 生日', age: 'Age / 年龄', phone: 'Phone / 电话', email: 'Email / 邮箱', username: 'Username / 用户名',
    password: 'Password / 密码', company: 'Company / 公司', jobTitle: 'Job title / 职位', street: 'Street address / 街道地址', address2: 'Address line 2 / 地址 2', address2Empty: 'None', city: 'City / 城市', stateField: 'State / 州', zip: 'ZIP code / 邮编', country: 'Country / 国家',
    fullAddress: 'Full address / 完整地址', latitude: 'Latitude / 纬度', longitude: 'Longitude / 经度', sourceField: 'Source / 来源', sourceValue: 'Local real US address pool; personal fields are synthetic',
  },
} as const

function stateLabel(state: string, language: UiLanguage) {
  const name = stateNames[state]
  if (!name) return state
  return language === 'zh' ? `${state} - ${name.zh} ${name.en}` : `${state} - ${name.en}`
}

function stateOptions() {
  const recommended = taxFreeStates.filter((state) => usStates.includes(state))
  const other = usStates.filter((state) => !taxFreeStates.includes(state as (typeof taxFreeStates)[number]))
  return { recommended, other }
}

function makeBirthday() {
  const age = 18 + randomInt(38)
  const now = new Date()
  const year = now.getFullYear() - age
  const month = randomInt(12)
  const day = 1 + randomInt(28)
  const birthday = new Date(year, month, day)
  const value = birthday.toISOString().slice(0, 10)
  return { age: String(age), value }
}

function makePhone(address: RealUsAddress) {
  const areaCodes: Record<string, readonly string[]> = {
    CA: ['213', '310', '415', '408', '650'], NY: ['212', '315', '518', '646'], TX: ['214', '512', '713', '817'], WA: ['206', '253', '425'],
    FL: ['305', '407', '561'], IL: ['312', '630', '708'], MA: ['617', '781', '857'], NC: ['704', '919', '980'], GA: ['404', '470', '678'],
    CO: ['303', '720'], PA: ['215', '412', '610'], MI: ['248', '313', '586'], OR: ['503', '971'], DC: ['202'], MN: ['612', '651'],
  }
  const area = randomItem(areaCodes[address.state] ?? ['202', '312', '415', '646'])
  return `+1 ${area}-${200 + randomInt(700)}-${1000 + randomInt(9000)}`
}

function makePassword() {
  return generatePassword(defaultPasswordOptions).value
}

function makeCompanyRole() {
  const company = randomItem(usCompanyProfiles)
  const categories = companyJobCategories[company.category] ?? companyJobCategories.generic
  const jobTitles = categories.flatMap((category) => [...usJobTitlesByCategory[category]])
  return { company: company.name, jobTitle: randomItem(jobTitles.length ? jobTitles : usJobTitlesByCategory.generic) }
}

function makeProfile(state: string, emailDomain: EmailDomain) {
  const addressPool = state === 'ALL' ? realUsAddresses : realUsAddresses.filter((address) => address.state === state)
  const address = randomItem(addressPool.length ? addressPool : realUsAddresses)
  const firstName = randomItem(usFirstNames)
  const lastName = randomItem(usLastNames)
  const fullName = `${firstName} ${lastName}`
  const birthday = makeBirthday()
  const suffix = String(100 + randomInt(900))
  const username = `${firstName}.${lastName}${suffix}`.toLowerCase()
  const domain = emailDomain === 'random' ? randomItem(concreteEmailDomains) : emailDomain
  const address2 = randomInt(3) === 0 ? `Apt ${100 + randomInt(800)}` : ''
  const streetLines = address2 ? `${address.street}, ${address2}` : address.street
  const companyRole = makeCompanyRole()

  return {
    firstName,
    lastName,
    fullName,
    gender: randomItem(genders),
    birthday: birthday.value,
    age: birthday.age,
    username,
    email: `${username}@${domain}`,
    password: makePassword(),
    phone: makePhone(address),
    company: companyRole.company,
    jobTitle: companyRole.jobTitle,
    address,
    fullAddress: `${streetLines}, ${address.city}, ${address.state} ${address.zip}`,
    address2,
  } satisfies Profile
}

function makeCopyText(profile: Profile, includeCoordinates: boolean, text: typeof labels[UiLanguage]) {
  const rows = [
    [text.fullName, profile.fullName],
    [text.firstName, profile.firstName],
    [text.lastName, profile.lastName],
    [text.gender, profile.gender],
    [text.birthday, profile.birthday],
    [text.age, profile.age],
    [text.phone, profile.phone],
    [text.email, profile.email],
    [text.username, profile.username],
    [text.password, profile.password],
    [text.company, profile.company],
    [text.jobTitle, profile.jobTitle],
    [text.street, profile.address.street],
    [text.address2, profile.address2],
    [text.city, profile.address.city],
    [text.stateField, profile.address.state],
    [text.zip, profile.address.zip],
    [text.country, 'United States'],
    [text.fullAddress, profile.fullAddress],
    [text.sourceField, text.sourceValue],
  ]
  const coordinateRows = includeCoordinates ? [[text.latitude, String(profile.address.latitude)], [text.longitude, String(profile.address.longitude)]] : []
  return [...rows, ...coordinateRows].filter(([, value]) => value).map(([label, value]) => `${label}: ${value}`).join('\n')
}

function FieldRow({ label, value, emptyLabel, copyLabel, copiedLabel }: { label: string; value: string; emptyLabel: string; copyLabel: string; copiedLabel: string }) {
  const [copied, setCopied] = useState(false)

  async function copyValue() {
    if (!value) return
    await navigator.clipboard.writeText(value)
    setCopied(true)
    window.setTimeout(() => setCopied(false), 900)
  }

  return (
    <button className="profile-field" type="button" onClick={copyValue} disabled={!value} title={value ? `${label}: ${value}` : emptyLabel} data-copied={copied}>
      <span>{label}</span>
      <strong>{value || emptyLabel}</strong>
      <em>{copied ? copiedLabel : copyLabel}</em>
    </button>
  )
}

function ProfileSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="profile-section">
      <h3>{title}</h3>
      <div className="profile-field-grid">{children}</div>
    </section>
  )
}

export function AddressTool() {
  const { locale, t } = useLocale()
  const language: UiLanguage = locale === 'zh-CN' ? 'zh' : 'en'
  const text = labels[language]
  const options = stateOptions()
  const [toolState, setToolState, resetToolState] = usePersistentState<AddressToolState>('utility-hub-tool-state:address-generator', () => ({ state: 'ALL', emailDomain: 'random', includeCoordinates: true }))
  const [seed, setSeed] = useState(0)
  const profile = useMemo(() => makeProfile(toolState.state, toolState.emailDomain), [toolState.state, toolState.emailDomain, seed])
  const copyText = useMemo(() => makeCopyText(profile, toolState.includeCoordinates, text), [profile, toolState.includeCoordinates, text])
  const mapsUrl = useMemo(() => `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(profile.fullAddress)}`, [profile.fullAddress])

  return (
    <div className="tool-workspace address-workspace">
      <Panel title={text.settings} actions={<button className="text-button" type="button" onClick={resetToolState}>{t.restoreDefaults}</button>}>
        <div className="address-settings-bar">
          <label className="field">
            <span>{text.state}</span>
            <select value={toolState.state} onChange={(event) => setToolState((current) => ({ ...current, state: event.target.value }))}>
              <option value="ALL">{text.randomState}</option>
              <optgroup label={text.taxFreeGroup}>
                {options.recommended.map((item) => <option key={item} value={item}>{stateLabel(item, language)}</option>)}
              </optgroup>
              <optgroup label={text.otherGroup}>
                {options.other.map((item) => <option key={item} value={item}>{stateLabel(item, language)}</option>)}
              </optgroup>
            </select>
          </label>
          <label className="field">
            <span>{text.emailDomain}</span>
            <select value={toolState.emailDomain} onChange={(event) => setToolState((current) => ({ ...current, emailDomain: event.target.value as EmailDomain }))}>
              {emailDomains.map((domain) => <option key={domain} value={domain}>{domain === 'random' ? text.randomDomain : domain}</option>)}
            </select>
          </label>
          <label className="check-row address-option-row">
            <input type="checkbox" checked={toolState.includeCoordinates} onChange={(event) => setToolState((current) => ({ ...current, includeCoordinates: event.target.checked }))} />
            {text.coordinates}
          </label>
          <button className="button primary address-generate-button" type="button" onClick={() => setSeed((value) => value + 1)}>{text.generate}</button>
        </div>
      </Panel>

      <Panel title={text.result}>
        <div className="profile-table">

          <div className="profile-section-pair">
            <ProfileSection title={text.identity}>
              <FieldRow label={text.fullName} value={profile.fullName} emptyLabel={text.empty} copyLabel={t.copy} copiedLabel={t.copied} />
              <FieldRow label={text.firstName} value={profile.firstName} emptyLabel={text.empty} copyLabel={t.copy} copiedLabel={t.copied} />
              <FieldRow label={text.lastName} value={profile.lastName} emptyLabel={text.empty} copyLabel={t.copy} copiedLabel={t.copied} />
              <FieldRow label={text.gender} value={profile.gender} emptyLabel={text.empty} copyLabel={t.copy} copiedLabel={t.copied} />
              <FieldRow label={text.birthday} value={profile.birthday} emptyLabel={text.empty} copyLabel={t.copy} copiedLabel={t.copied} />
              <FieldRow label={text.age} value={profile.age} emptyLabel={text.empty} copyLabel={t.copy} copiedLabel={t.copied} />
              <FieldRow label={text.phone} value={profile.phone} emptyLabel={text.empty} copyLabel={t.copy} copiedLabel={t.copied} />
            </ProfileSection>

            <ProfileSection title={text.account}>
              <FieldRow label={text.username} value={profile.username} emptyLabel={text.empty} copyLabel={t.copy} copiedLabel={t.copied} />
              <FieldRow label={text.email} value={profile.email} emptyLabel={text.empty} copyLabel={t.copy} copiedLabel={t.copied} />
              <FieldRow label={text.password} value={profile.password} emptyLabel={text.empty} copyLabel={t.copy} copiedLabel={t.copied} />
              <FieldRow label={text.company} value={profile.company} emptyLabel={text.empty} copyLabel={t.copy} copiedLabel={t.copied} />
              <FieldRow label={text.jobTitle} value={profile.jobTitle} emptyLabel={text.empty} copyLabel={t.copy} copiedLabel={t.copied} />
            </ProfileSection>
          </div>

          <ProfileSection title={text.address}>
            <FieldRow label={text.street} value={profile.address.street} emptyLabel={text.empty} copyLabel={t.copy} copiedLabel={t.copied} />
            <FieldRow label={text.address2} value={profile.address2} emptyLabel={text.address2Empty} copyLabel={t.copy} copiedLabel={t.copied} />
            <FieldRow label={text.city} value={profile.address.city} emptyLabel={text.empty} copyLabel={t.copy} copiedLabel={t.copied} />
            <FieldRow label={text.stateField} value={profile.address.state} emptyLabel={text.empty} copyLabel={t.copy} copiedLabel={t.copied} />
            <FieldRow label={text.zip} value={profile.address.zip} emptyLabel={text.empty} copyLabel={t.copy} copiedLabel={t.copied} />
            <FieldRow label={text.country} value="United States" emptyLabel={text.empty} copyLabel={t.copy} copiedLabel={t.copied} />
            <FieldRow label={text.fullAddress} value={profile.fullAddress} emptyLabel={text.empty} copyLabel={t.copy} copiedLabel={t.copied} />
            {toolState.includeCoordinates && <FieldRow label={text.latitude} value={String(profile.address.latitude)} emptyLabel={text.empty} copyLabel={t.copy} copiedLabel={t.copied} />}
            {toolState.includeCoordinates && <FieldRow label={text.longitude} value={String(profile.address.longitude)} emptyLabel={text.empty} copyLabel={t.copy} copiedLabel={t.copied} />}
          </ProfileSection>

          <div className="action-row profile-actions">
            <CopyButton value={copyText} />
            <a className="button secondary" href={mapsUrl} target="_blank" rel="noreferrer"><MapPin size={16} />{text.maps}</a>
            <button className="button primary" type="button" onClick={() => setSeed((value) => value + 1)}>{text.generate}</button>
          </div>
        </div>
      </Panel>
    </div>
  )
}
