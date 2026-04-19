import { Monitor, Moon, Sun } from "lucide-react"

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from "~components/ui/card"
import { ToggleGroup, ToggleGroupItem } from "~components/ui/toggle-group"
import type { Theme } from "~lib/theme"
import { useTheme } from "~lib/use-theme"

const OPTIONS: Array<{
  value: Theme
  label: string
  icon: typeof Sun
}> = [
  { value: "light", label: "Light", icon: Sun },
  { value: "dark", label: "Dark", icon: Moon },
  { value: "system", label: "System", icon: Monitor }
]

export function ThemeCard() {
  const { theme, setTheme } = useTheme()

  return (
    <Card>
      <CardHeader className="p-4 pb-2">
        <CardTitle className="text-base">Appearance</CardTitle>
        <CardDescription className="text-xs">
          Light, dark, or follow your OS setting.
        </CardDescription>
      </CardHeader>
      <CardContent className="p-4 pt-0">
        <ToggleGroup
          type="single"
          value={theme}
          onValueChange={(value) => {
            if (value === "light" || value === "dark" || value === "system") {
              setTheme(value)
            }
          }}
          className="justify-start">
          {OPTIONS.map(({ value, label, icon: Icon }) => (
            <ToggleGroupItem
              key={value}
              value={value}
              variant="outline"
              className="data-[state=on]:bg-primary data-[state=on]:text-primary-foreground">
              <Icon className="mr-1 h-3.5 w-3.5" />
              {label}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
      </CardContent>
    </Card>
  )
}
