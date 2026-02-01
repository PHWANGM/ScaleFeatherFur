// src/screens/SpeciesEditorScreen.tsx
import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TextInput as RNTextInput,
  TouchableOpacity,
  View,
} from "react-native"
import {
  NavigationProp,
  RouteProp,
  useNavigation,
  useRoute,
} from "@react-navigation/native"
import { useTranslation } from "react-i18next"

import {
  deleteSpecies,
  getSpeciesByKey,
  insertSpecies,
  updateSpecies,
} from "../lib/db/repos/species.repo"
import Field from "../components/fields/Field"

type RootStackParamList = {
  SpeciesEditor: { key?: string } | undefined
}

type SpeciesEditorRoute = RouteProp<RootStackParamList, "SpeciesEditor">

const BG_DARK = "#122017"
const PRIMARY = "#38e07b"

function slugifyCommonName(v: string): string {
  return v
    .trim()
    .toLowerCase()
    .replace(/[\s/]+/g, "-") // space or slash -> '-'
    .replace(/[^a-z0-9\-_]/g, "") // keep a-z0-9_- only
    .replace(/-+/g, "-") // merge multiple '-'
    .replace(/^[-_]+|[-_]+$/g, "") // trim leading/trailing -_
}

export default function SpeciesEditorScreen() {
  const { t } = useTranslation()

  const route = useRoute<SpeciesEditorRoute>()
  const navigation = useNavigation<NavigationProp<RootStackParamList>>()

  const editingKeyParam = route.params?.key
  const isEditing = !!editingKeyParam

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  // form
  const [keyValue, setKeyValue] = useState("")
  const [commonName, setCommonName] = useState("")
  const [scientificName, setScientificName] = useState("")
  const [notes, setNotes] = useState("")

  const [keyTouched, setKeyTouched] = useState(false) // once user edits key, stop auto-gen

  // refs for Next focus
  const refKey = useRef<RNTextInput>(null)
  const refCommon = useRef<RNTextInput>(null)
  const refScientific = useRef<RNTextInput>(null)
  const refNotes = useRef<RNTextInput>(null)

  const title = useMemo(
    () => (isEditing
      ? t("speciesEditor.title.edit")
      : t("speciesEditor.title.add")),
    [isEditing, t],
  )

  // load data for edit mode
  useEffect(() => {
    let alive = true
    ;(async () => {
      try {
        setLoading(true)

        if (isEditing && editingKeyParam) {
          const row = await getSpeciesByKey(editingKeyParam)

          if (!row) {
            Alert.alert(
              t("speciesEditor.alerts.notFound.title"),
              t("speciesEditor.alerts.notFound.message", {
                key: editingKeyParam,
              }),
            )
            navigation.goBack()
            return
          }

          if (!alive) return

          setKeyValue(row.key)
          setCommonName(row.common_name)
          setScientificName(row.scientific_name ?? "")
          setNotes(row.notes ?? "")
          setKeyTouched(true) // don't auto-overwrite in edit mode
        } else {
          // new mode: focus common name
          setTimeout(() => refCommon.current?.focus(), 0)
        }
      } catch (err: unknown) {
        Alert.alert(
          t("speciesEditor.alerts.loadFailed.title"),
          err?.message ?? String(err),
        )
      } finally {
        if (alive) setLoading(false)
      }
    })()

    return () => {
      alive = false
    }
  }, [isEditing, editingKeyParam, navigation, t])

  // auto-generate key from common name (only in create mode & not manually touched)
  useEffect(() => {
    if (!keyTouched && !isEditing) {
      const slug = slugifyCommonName(commonName)
      setKeyValue(slug)
    }
  }, [commonName, keyTouched, isEditing])

  const validate = useCallback(async (): Promise<boolean> => {
    if (!keyValue.trim()) {
      Alert.alert(
        t("speciesEditor.alerts.validation.title"),
        t("speciesEditor.alerts.validation.keyRequired"),
      )
      refKey.current?.focus()
      return false
    }

    if (!/^[a-z0-9\-_]+$/.test(keyValue)) {
      Alert.alert(
        t("speciesEditor.alerts.validation.title"),
        t("speciesEditor.alerts.validation.keyInvalidChars"),
      )
      refKey.current?.focus()
      return false
    }

    if (!commonName.trim()) {
      Alert.alert(
        t("speciesEditor.alerts.validation.title"),
        t("speciesEditor.alerts.validation.commonNameRequired"),
      )
      refCommon.current?.focus()
      return false
    }

    // on create: check duplicate key
    // on edit: key is locked; still safe to check if somehow changed
    if (!isEditing || keyValue !== editingKeyParam) {
      const dup = await getSpeciesByKey(keyValue)
      if (dup) {
        Alert.alert(
          t("speciesEditor.alerts.validation.title"),
          t("speciesEditor.alerts.validation.keyExists", { key: keyValue }),
        )
        refKey.current?.focus()
        return false
      }
    }

    return true
  }, [keyValue, commonName, isEditing, editingKeyParam, t])

  const onSave = useCallback(async () => {
    if (!(await validate())) return

    try {
      setSaving(true)

      if (isEditing && editingKeyParam) {
        // key is locked (avoid FK issues)
        await updateSpecies(editingKeyParam, {
          common_name: commonName.trim(),
          scientific_name: scientificName.trim() || null,
          notes: notes.trim() || null,
        })
      } else {
        await insertSpecies({
          key: keyValue.trim(),
          common_name: commonName.trim(),
          scientific_name: scientificName.trim() || null,
          notes: notes.trim() || null,
        })
      }

      navigation.goBack()
    } catch (err: unknown) {
      Alert.alert(
        t("speciesEditor.alerts.saveFailed.title"),
        err?.message ?? String(err),
      )
    } finally {
      setSaving(false)
    }
  }, [
    validate,
    isEditing,
    editingKeyParam,
    keyValue,
    commonName,
    scientificName,
    notes,
    navigation,
    t,
  ])

  const onDelete = useCallback(() => {
    if (!isEditing || !editingKeyParam) return

    Alert.alert(
      t("speciesEditor.alerts.deleteConfirm.title"),
      t("speciesEditor.alerts.deleteConfirm.message", {
        name: commonName || editingKeyParam,
      }),
      [
        { text: t("common.cancel"), style: "cancel" },
        {
          text: t("speciesEditor.actions.delete"),
          style: "destructive",
          onPress: async () => {
            try {
              setSaving(true)
              const ok = await deleteSpecies(editingKeyParam)
              if (!ok) {
                Alert.alert(
                  t("speciesEditor.alerts.deleteFailed.title"),
                  t("speciesEditor.alerts.deleteFailed.message"),
                )
                return
              }
              navigation.goBack()
            } catch (err: unknown) {
              Alert.alert(
                t("speciesEditor.alerts.deleteFailed.title"),
                err?.message ?? String(err),
              )
            } finally {
              setSaving(false)
            }
          },
        },
      ],
    )
  }, [isEditing, editingKeyParam, commonName, navigation, t])

  if (loading) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator />
      </View>
    )
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={styles.closeButton}>✕</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{title}</Text>
        <View style={{ width: 24 }} />
      </View>

      {/* Body */}
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.select({ ios: "padding", android: undefined })}
      >
        <ScrollView
          contentContainerStyle={styles.body}
          keyboardShouldPersistTaps="handled"
        >
          {/* Key (locked in edit mode) */}
          <Field label={t("speciesEditor.fields.key.label")}>
            <TextInput
              ref={refKey}
              placeholder={t("speciesEditor.fields.key.placeholder")}
              placeholderTextColor="rgba(255,255,255,0.5)"
              value={keyValue}
              onChangeText={(txt) => {
                setKeyTouched(true)
                setKeyValue(txt.toLowerCase())
              }}
              editable={!isEditing}
              style={[styles.input, isEditing && styles.inputDisabled]}
              autoCapitalize="none"
              autoCorrect={false}
              autoComplete="off"
              textContentType="none"
              returnKeyType="next"
              blurOnSubmit={false}
              onSubmitEditing={() => refCommon.current?.focus()}
            />

            {isEditing
              ? (
                <Text style={styles.helpText}>
                  {t("speciesEditor.fields.key.lockedHint")}
                </Text>
              )
              : (
                <Text style={styles.helpText}>
                  {t("speciesEditor.fields.key.help")}
                </Text>
              )}
          </Field>

          {/* Common name */}
          <Field label={t("speciesEditor.fields.commonName.label")}>
            <TextInput
              ref={refCommon}
              placeholder={t("speciesEditor.fields.commonName.placeholder")}
              placeholderTextColor="rgba(255,255,255,0.5)"
              value={commonName}
              onChangeText={setCommonName}
              style={styles.input}
              autoCapitalize="words"
              autoCorrect
              autoComplete="name"
              textContentType="name"
              returnKeyType="next"
              blurOnSubmit={false}
              onSubmitEditing={() => refScientific.current?.focus()}
            />
          </Field>

          {/* Scientific name (optional) */}
          <Field label={t("speciesEditor.fields.scientificName.label")}>
            <TextInput
              ref={refScientific}
              placeholder={t("speciesEditor.fields.scientificName.placeholder")}
              placeholderTextColor="rgba(255,255,255,0.5)"
              value={scientificName}
              onChangeText={setScientificName}
              style={styles.input}
              autoCapitalize="words"
              autoCorrect
              autoComplete="off"
              textContentType="none"
              returnKeyType="next"
              blurOnSubmit={false}
              onSubmitEditing={() => refNotes.current?.focus()}
            />
          </Field>

          {/* Notes (optional) */}
          <Field label={t("speciesEditor.fields.notes.label")}>
            <TextInput
              ref={refNotes}
              placeholder={t("speciesEditor.fields.notes.placeholder")}
              placeholderTextColor="rgba(255,255,255,0.5)"
              value={notes}
              onChangeText={setNotes}
              style={[styles.input, styles.notes]}
              multiline
              textAlignVertical="top"
              returnKeyType="done"
            />
          </Field>
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Footer */}
      <View style={styles.footerRow}>
        {isEditing
          ? (
            <TouchableOpacity
              disabled={saving}
              onPress={onDelete}
              style={styles.dangerBtn}
            >
              <Text style={styles.dangerBtnText}>
                {t("speciesEditor.actions.delete")}
              </Text>
            </TouchableOpacity>
          )
          : <View style={{ flex: 1 }} />}

        <TouchableOpacity
          disabled={saving}
          onPress={onSave}
          style={styles.primaryBtn}
        >
          <Text style={styles.primaryBtnText}>
            {saving ? t("speciesEditor.actions.saving") : t("common.save")}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: BG_DARK },
  header: {
    height: 56,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "rgba(255,255,255,0.1)",
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
  },
  closeButton: { color: "white", fontSize: 20, width: 24, textAlign: "center" },
  headerTitle: {
    flex: 1,
    textAlign: "center",
    color: "white",
    fontSize: 18,
    fontWeight: "bold",
    paddingRight: 24,
  },

  body: { padding: 16, gap: 14 },

  input: {
    backgroundColor: "rgba(255,255,255,0.08)",
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 12,
    color: "white",
  },
  inputDisabled: { opacity: 0.6 },
  notes: { minHeight: 120 },

  helpText: {
    marginTop: 8,
    color: "rgba(255,255,255,0.65)",
    fontSize: 12,
    lineHeight: 16,
  },

  footerRow: {
    padding: 16,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "rgba(255,255,255,0.1)",
    backgroundColor: BG_DARK,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  primaryBtn: {
    backgroundColor: PRIMARY,
    borderRadius: 16,
    paddingVertical: 14,
    paddingHorizontal: 18,
    alignItems: "center",
  },
  primaryBtnText: { color: BG_DARK, fontWeight: "bold", fontSize: 16 },

  dangerBtn: {
    flex: 1,
    backgroundColor: "rgba(255, 99, 71, 0.15)",
    borderRadius: 16,
    paddingVertical: 14,
    alignItems: "center",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(255, 99, 71, 0.4)",
  },
  dangerBtnText: { color: "tomato", fontWeight: "bold" },

  loading: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: BG_DARK,
  },
})
