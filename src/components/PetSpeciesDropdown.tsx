// src/components/PetSpeciesDropdown.tsx
import React, { useEffect, useMemo, useState } from "react"
import { Pressable, StyleSheet, Text, View } from "react-native"
import { Feather } from "@expo/vector-icons"

// ✅ 從本地 DB 讀物種
import { listSpecies, type SpeciesRow } from "../lib/db/repos/species.repo"

type SpeciesOption = { value: string; label: string }

type PaletteLike = {
  inputBg: string
  border: string
  text: string
  subText: string
  link: string
  [key: string]: string | undefined
}

type Props = {
  label?: string
  value: string
  onChange: (value: string) => void
  onAddSpecies?: () => void // 點擊「＋ Add Species」時呼叫
  palette: PaletteLike
  options?: SpeciesOption[] // 若有傳入，就 override DB 資料
}

const fallbackOptions: SpeciesOption[] = [
  { value: "dog", label: "🐶 狗狗" },
  { value: "cat", label: "🐱 貓咪" },
  { value: "rabbit", label: "🐰 兔兔" },
  { value: "hamster", label: "🐹 倉鼠" },
  { value: "bird", label: "🐦 鳥寶" },
  { value: "reptile", label: "🦎 爬蟲" },
  { value: "other", label: "🐾 其他" },
]

const PetSpeciesDropdown: React.FC<Props> = ({
  label = "寵物物種",
  value,
  onChange,
  onAddSpecies,
  palette,
  options,
}) => {
  const [open, setOpen] = useState(false)
  const [dbOptions, setDbOptions] = useState<SpeciesOption[] | null>(null)
  const [loading, setLoading] = useState(false)
  const [loadError, setLoadError] = useState<string | null>(null)

  // 一進來就從 DB 抓 species 列表
  useEffect(() => {
    let mounted = true

    const load = async () => {
      try {
        setLoading(true)
        setLoadError(null)
        const rows = await listSpecies()
        if (!mounted) return

        const mapped: SpeciesOption[] = rows.map((row: SpeciesRow) => ({
          value: row.key,
          label: row.common_name || row.key,
        }))
        setDbOptions(mapped)
      } catch (e: unknown) {
        if (!mounted) return
        console.error("load species error", e)
        const message = e instanceof Error ? e.message : undefined
        setLoadError(message ?? "載入物種失敗")
        setDbOptions(null)
      } finally {
        if (mounted) setLoading(false)
      }
    }

    load()
    return () => {
      mounted = false
    }
  }, [])

  const speciesOptions = useMemo(() => {
    // 若父層有傳入 options，優先使用
    if (options && options.length > 0) return options

    // 若 DB 有回來（即使是空陣列）就用 DB 的結果
    if (dbOptions) return dbOptions

    // DB 還沒載好 / 出錯時，用 fallback
    return fallbackOptions
  }, [options, dbOptions])

  const selectedLabel =
    speciesOptions.find((opt) => opt.value === value)?.label ?? "選擇物種"

  const showEmptyFromDb = !loading &&
    !options && // 沒有客製 options
    dbOptions &&
    dbOptions.length === 0

  return (
    <View style={{ marginBottom: 16 }}>
      <Text style={[styles.label, { color: palette.subText }]}>
        {label}
      </Text>

      <Pressable
        onPress={() => setOpen((prev) => !prev)}
        style={[
          styles.input,
          styles.dropdownTrigger,
          {
            backgroundColor: palette.inputBg,
          },
        ]}
      >
        <Text
          style={{ color: palette.text, flex: 1 }}
          numberOfLines={1}
        >
          {selectedLabel}
        </Text>
        <Feather
          name={open ? "chevron-up" : "chevron-down"}
          size={18}
          color={palette.subText}
        />
      </Pressable>

      {open && (
        <View
          style={[
            styles.dropdownMenu,
            {
              backgroundColor: palette.inputBg,
              borderColor: palette.border,
            },
          ]}
        >
          {loading && (
            <View style={styles.dropdownItem}>
              <Text style={{ color: palette.subText }}>載入物種中…</Text>
            </View>
          )}

          {!loading && loadError && (
            <View style={styles.dropdownItem}>
              <Text style={{ color: palette.subText, fontSize: 12 }}>
                載入失敗，使用預設物種列表
              </Text>
            </View>
          )}

          {showEmptyFromDb && (
            <View style={styles.dropdownItem}>
              <Text style={{ color: palette.subText, fontSize: 12 }}>
                尚未建立任何物種，請先新增
              </Text>
            </View>
          )}

          {/* 只有在有可選項時才 render 一般選項 */}
          {!showEmptyFromDb &&
            speciesOptions.map((opt) => (
              <Pressable
                key={opt.value}
                onPress={() => {
                  onChange(opt.value)
                  setOpen(false)
                }}
                style={styles.dropdownItem}
              >
                <Text
                  style={{
                    color: palette.text,
                    fontWeight: opt.value === value ? "700" : "400",
                  }}
                >
                  {opt.label}
                </Text>
              </Pressable>
            ))}

          {onAddSpecies && (
            <>
              <View
                style={[
                  styles.dropdownDivider,
                  { backgroundColor: palette.border || "#e5e7eb" },
                ]}
              />
              <Pressable
                style={[
                  styles.dropdownItem,
                  { flexDirection: "row", alignItems: "center" },
                ]}
                onPress={() => {
                  setOpen(false)
                  onAddSpecies()
                }}
              >
                <Feather
                  name="plus-circle"
                  size={16}
                  color={palette.link}
                />
                <Text
                  style={{
                    marginLeft: 6,
                    color: palette.link,
                    fontWeight: "600",
                  }}
                >
                  ＋ Add Species
                </Text>
              </Pressable>
            </>
          )}
        </View>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  label: {
    fontSize: 12,
    fontWeight: "700",
    marginBottom: 6,
    marginTop: 12,
    textTransform: "uppercase",
  },
  input: {
    borderRadius: 12,
    padding: 12,
    fontSize: 16,
    flexDirection: "row",
    alignItems: "center",
  },
  dropdownTrigger: {},
  dropdownMenu: {
    marginTop: 4,
    borderRadius: 12,
    paddingVertical: 4,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: "hidden",
  },
  dropdownItem: {
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  dropdownDivider: {
    height: StyleSheet.hairlineWidth,
    marginVertical: 4,
  },
})

export default PetSpeciesDropdown
