// src/components/warning/CareAlerts.tsx
import { StyleSheet, Text, View } from "react-native"
import { MaterialCommunityIcons } from "@expo/vector-icons"
import { useTranslation } from "react-i18next"

// warnings
import TemperatureWarning from "./TemperatureWarning"
import UVBWarning from "./UVBWarning"
import FeedingWarning from "./FeedingWarning"
import CalciumWarning from "./CalciumWarning"
import VitaminD3Warning from "./VitaminD3Warning"
import type {
  Next24hTempRiskResult,
} from "../../lib/compliance/envTempForecast.service"
import type {
  Next24hUvbRiskResult,
} from "../../lib/compliance/uvbForecast.service"

type Palette = {
  card: string
  border: string
  text: string
  subText: string
  primary: string
}

type Props = {
  palette: Palette
  speciesLabel: string
  currentPetId: string | null
  tempRisk: Next24hTempRiskResult | null
  uvbRisk: Next24hUvbRiskResult | null
}

export default function CareAlerts({
  palette,
  speciesLabel,
  currentPetId,
  tempRisk,
  uvbRisk,
}: Props) {
  const { t } = useTranslation()

  return (
    <View style={{ marginTop: 16 }}>
      <View style={styles.sectionHeaderRow}>
        <Text style={[styles.sectionTitle, { color: palette.text }]}>
          {t("home.careAlerts")}
        </Text>
        <Text style={[styles.sectionHint, { color: palette.subText }]}>
          {speciesLabel}
        </Text>
      </View>

      <View
        style={[styles.card, {
          backgroundColor: palette.card,
          borderColor: palette.border,
        }]}
      >
        <TemperatureWarning tempRisk={tempRisk} />
        <UVBWarning uvbRisk={uvbRisk} />
        <FeedingWarning petId={currentPetId} />
        <CalciumWarning petId={currentPetId} />
        <VitaminD3Warning petId={currentPetId} />

        <View style={[styles.alertRow, { marginTop: 10 }]}>
          <View
            style={[
              styles.alertIconBox,
              { backgroundColor: "rgba(56,224,123,0.2)" },
            ]}
          >
            <MaterialCommunityIcons
              name="stethoscope"
              size={22}
              color={palette.primary}
            />
          </View>

          <View style={{ flex: 1 }}>
            <Text style={[styles.alertTitle, { color: palette.text }]}>
              {t("home.vetCheckup.title")}
            </Text>
            <Text style={[styles.alertSub, { color: palette.subText }]}>
              {t("home.vetCheckup.subtitle")}
            </Text>
          </View>
        </View>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  sectionHeaderRow: {
    flexDirection: "row",
    alignItems: "baseline",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  sectionTitle: { fontSize: 18, fontWeight: "700" },
  sectionHint: { fontSize: 14, fontWeight: "500" },
  card: {
    borderRadius: 12,
    padding: 12,
    borderWidth: StyleSheet.hairlineWidth,
  },
  alertRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  alertIconBox: {
    width: 48,
    height: 48,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  alertTitle: { fontSize: 16, fontWeight: "600" },
  alertSub: { fontSize: 12, marginTop: 2 },
})
