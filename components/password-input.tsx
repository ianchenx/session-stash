import { Eye, EyeOff } from "lucide-react"
import { forwardRef, useState } from "react"

import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput
} from "~components/ui/input-group"

type PasswordInputProps = Omit<
  React.ComponentProps<typeof InputGroupInput>,
  "type"
> & {
  defaultReveal?: boolean
}

export const PasswordInput = forwardRef<HTMLInputElement, PasswordInputProps>(
  ({ defaultReveal = false, ...props }, ref) => {
    const [reveal, setReveal] = useState(defaultReveal)
    const Icon = reveal ? EyeOff : Eye

    return (
      <InputGroup>
        <InputGroupInput
          ref={ref}
          type={reveal ? "text" : "password"}
          autoComplete="off"
          spellCheck={false}
          {...props}
        />
        <InputGroupAddon align="inline-end">
          <InputGroupButton
            type="button"
            aria-label={reveal ? "Hide" : "Show"}
            onClick={() => setReveal((value) => !value)}>
            <Icon />
          </InputGroupButton>
        </InputGroupAddon>
      </InputGroup>
    )
  }
)

PasswordInput.displayName = "PasswordInput"
