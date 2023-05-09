import React, { FC, ReactNode, useMemo, useState } from "react"
import {
  Typography,
  Box,
  useTheme,
  Card,
  FormControlLabel,
  FormControl,
  FormLabel,
  Button,
  RadioGroup,
  Radio,
  Slider,
  TextField,
} from "@mui/material"
import { DebouncedInputTextField } from "./Debounce"
import { actionCreator } from "../action"

type WidgetState = {
  isValid: boolean
  value: number | string
  render: () => ReactNode
}

export const ObjectiveForm: FC<{
  trial: Trial
  directions: StudyDirection[]
  names: string[]
  formWidgets: FormWidgets
}> = ({ trial, directions, names, formWidgets }) => {
  const theme = useTheme()
  const action = actionCreator()

  const widgetStates = formWidgets.widgets
    .map((w, i) => {
      const key = `${formWidgets.output_type}-${i}`
      const outputType = formWidgets.output_type
      const metricName = getMetricName(formWidgets, names, directions, i)
      if (w.type === "text") {
        return useTextInputWidget(key, outputType, w, metricName)
      } else if (w.type === "choice") {
        return useChoiceWidget(key, outputType, w, metricName)
      } else if (w.type === "slider") {
        return useSliderWidget(key, outputType, w, metricName)
      } else if (w.type === "user_attr") {
        return useUserAttrRefWidget(key, w, metricName, trial)
      }
      console.error("Must not reach here")
      return undefined
    })
    .filter((w): w is WidgetState => w !== undefined)

  const disableSubmit = useMemo<boolean>(
    () => !widgetStates.every((ws) => ws.isValid),
    [widgetStates]
  )

  const handleSubmit = (e: React.MouseEvent<HTMLButtonElement>): void => {
    e.preventDefault()
    const values = widgetStates.map((ws) => ws.value)
    if (formWidgets.output_type == "objective") {
      const filtered = values.filter<number>((v): v is number => v !== null)
      if (filtered.length !== directions.length) {
        return
      }
      action.makeTrialComplete(trial.study_id, trial.trial_id, filtered)
    } else if (formWidgets.output_type == "user_attr") {
      const user_attrs = Object.fromEntries(
        formWidgets.widgets.map((widget, i) => [
          widget.user_attr_key,
          values[i] !== null ? values[i] : "",
        ])
      )
      action.saveTrialUserAttrs(trial.study_id, trial.trial_id, user_attrs)
    }
  }

  const headerText =
    formWidgets.output_type === "user_attr"
      ? "Set User Attributes Form"
      : directions.length > 1
      ? "Set Objective Values Form"
      : "Set Objective Value Form"

  return (
    <>
      <Typography
        variant="h5"
        sx={{ fontWeight: theme.typography.fontWeightBold }}
      >
        {headerText}
      </Typography>
      <Box sx={{ p: theme.spacing(1, 0) }}>
        <Card
          sx={{
            display: "flex",
            flexDirection: "column",
            marginBottom: theme.spacing(2),
            margin: theme.spacing(0, 1, 1, 0),
            p: theme.spacing(1),
          }}
        >
          {widgetStates.map((ws) => ws.render())}
          <Box
            sx={{
              display: "flex",
              flexDirection: "row",
              margin: theme.spacing(1, 2),
            }}
          >
            <Button
              variant="contained"
              type="submit"
              sx={{ marginRight: theme.spacing(1) }}
              disabled={disableSubmit}
              onClick={handleSubmit}
            >
              Submit
            </Button>
            <Box sx={{ flexGrow: 1 }} />
            <Button
              variant="outlined"
              color="error"
              onClick={() => {
                action.makeTrialFail(trial.study_id, trial.trial_id)
              }}
            >
              Fail Trial
            </Button>
          </Box>
        </Card>
      </Box>
    </>
  )
}

export const useTextInputWidget = (
  key: string,
  widgetType: "user_attr" | "objective",
  widget: ObjectiveTextInputWidget,
  metricName: string
): WidgetState => {
  const theme = useTheme()
  const [value, setValue] = useState<number | string>("")
  const isValid = useMemo(
    () =>
      widgetType === "user_attr"
        ? value !== "" || widget.optional
        : value !== "" && !isNaN(Number(value)),
    [widget, value]
  )

  const inputProps =
    widgetType === "objective"
      ? {
          pattern: "[-+]?[0-9]*.?[0-9]+([eE][-+]?[0-9]+)?",
        }
      : undefined
  const helperText =
    !widget.optional && value === "" ? `Please input the float number.` : ""
  const render = () => (
    <FormControl key={key} sx={{ margin: theme.spacing(1, 2) }}>
      <FormLabel>
        {metricName} - {widget.description}
      </FormLabel>
      <DebouncedInputTextField
        onChange={(s, valid) => {
          if (widgetType === "user_attr") {
            setValue(s)
            return
          }

          const n = Number(s)
          if (s.length > 0 && valid && !isNaN(n)) {
            setValue(n)
          } else {
            setValue("")
          }
        }}
        delay={500}
        textFieldProps={{
          type: "text",
          autoFocus: true,
          fullWidth: true,
          required: !widget.optional,
          helperText,
          inputProps,
        }}
      />
    </FormControl>
  )
  return { isValid, value, render }
}

export const useChoiceWidget = (
  key: string,
  widgetType: "user_attr" | "objective",
  widget: ObjectiveChoiceWidget,
  metricName: string
): WidgetState => {
  const theme = useTheme()
  const [value, setValue] = useState<number>(widget.values[0])
  const render = () => (
    <FormControl key={key} sx={{ margin: theme.spacing(1, 2) }}>
      <FormLabel>
        {metricName} - {widget.description}
      </FormLabel>
      <RadioGroup row defaultValue={widget.values.at(0)}>
        {widget.choices.map((c, j) => (
          <FormControlLabel
            key={c}
            control={
              <Radio
                checked={value === widget.values.at(j)}
                onChange={(e) => {
                  const selected = widget.values.at(j)
                  if (selected === undefined) {
                    console.error("Must not reach here.")
                    return
                  }
                  if (e.target.checked) {
                    setValue(selected)
                  }
                }}
              />
            }
            label={c}
          />
        ))}
      </RadioGroup>
    </FormControl>
  )
  return { isValid: true, value, render }
}

export const useSliderWidget = (
  key: string,
  widgetType: "user_attr" | "objective",
  widget: ObjectiveSliderWidget,
  metricName: string
): WidgetState => {
  const theme = useTheme()
  const [value, setValue] = useState<number>(widget.min)
  const render = () => (
    <FormControl key={key} sx={{ margin: theme.spacing(1, 2) }}>
      <FormLabel>
        {metricName} - {widget.description}
      </FormLabel>
      <Box sx={{ padding: theme.spacing(0, 2) }}>
        <Slider
          onChange={(e) => {
            // @ts-ignore
            setValue(e.target.value as number)
          }}
          defaultValue={widget.min}
          min={widget.min}
          max={widget.max}
          step={widget.step}
          marks={
            widget.labels === null || widget.labels.length == 0
              ? true
              : widget.labels
          }
          valueLabelDisplay="auto"
        />
      </Box>
    </FormControl>
  )
  return { isValid: true, value, render }
}

export const useUserAttrRefWidget = (
  key: string,
  widget: ObjectiveUserAttrRef,
  metricName: string,
  trial: Trial
): WidgetState => {
  const theme = useTheme()
  const value = useMemo(() => {
    const attr = trial.user_attrs.find((attr) => attr.key === widget.key)
    if (attr === undefined) {
      return null
    }
    const n = Number(attr.value)
    if (isNaN(n)) {
      return null
    }
    return n
  }, [trial.user_attrs])
  const render = () => (
    <FormControl key={key} sx={{ margin: theme.spacing(1, 2) }}>
      <FormLabel>{metricName}</FormLabel>
      <TextField
        inputProps={{ readOnly: true }}
        value={value || ""}
        error={value === null}
        helperText={
          value === null
            ? `This objective value is referred from trial.user_attrs[${widget.key}].`
            : ""
        }
      />
    </FormControl>
  )
  return {
    isValid: value !== null,
    value: value !== null ? value : "",
    render,
  }
}

export const ReadonlyObjectiveForm: FC<{
  trial: Trial
  directions: StudyDirection[]
  names: string[]
  formWidgets: FormWidgets
}> = ({ trial, directions, names, formWidgets }) => {
  const theme = useTheme()
  const getValue = (i: number): string | TrialValueNumber => {
    if (formWidgets.output_type === "user_attr") {
      const widget = formWidgets.widgets[i] as UserAttrFormWidget
      return (
        trial.user_attrs.find((attr) => attr.key === widget.user_attr_key)
          ?.value || ""
      )
    }
    const value = trial.values?.at(i)
    if (value === undefined) {
      console.error("Must not reach here.")
      return 0
    }
    return value
  }

  return (
    <>
      <Typography
        variant="h5"
        sx={{ fontWeight: theme.typography.fontWeightBold }}
      >
        {directions.length > 1 ? "Set Objective Values" : "Set Objective Value"}
      </Typography>
      <Box sx={{ p: theme.spacing(1, 0) }}>
        <Card
          sx={{
            display: "flex",
            flexDirection: "column",
            marginBottom: theme.spacing(2),
            margin: theme.spacing(0, 1, 1, 0),
            p: theme.spacing(1),
          }}
        >
          {formWidgets.widgets.map((widget, i) => {
            const key = `objective-${i}`
            const metricName = getMetricName(formWidgets, names, directions, i)
            if (widget.type === "text") {
              return (
                <FormControl key={key} sx={{ margin: theme.spacing(1, 2) }}>
                  <FormLabel>
                    {metricName} - {widget.description}
                  </FormLabel>
                  <TextField
                    inputProps={{ readOnly: true }}
                    value={getValue(i)}
                  />
                </FormControl>
              )
            } else if (widget.type === "choice") {
              return (
                <FormControl key={key} sx={{ margin: theme.spacing(1, 2) }}>
                  <FormLabel>
                    {metricName} - {widget.description}
                  </FormLabel>
                  <RadioGroup row defaultValue={trial.values?.at(i)}>
                    {widget.choices.map((c, j) => (
                      <FormControlLabel
                        key={c}
                        control={
                          <Radio
                            checked={
                              trial.values?.at(i) === widget.values.at(j)
                            }
                          />
                        }
                        label={c}
                        disabled
                      />
                    ))}
                  </RadioGroup>
                </FormControl>
              )
            } else if (widget.type === "slider") {
              const value = trial.values?.at(i)
              return (
                <FormControl key={key} sx={{ margin: theme.spacing(1, 2) }}>
                  <FormLabel>
                    {metricName} - {widget.description}
                  </FormLabel>
                  <Box sx={{ padding: theme.spacing(0, 2) }}>
                    <Slider
                      defaultValue={
                        value === "inf" || value === "-inf" ? undefined : value
                      }
                      min={widget.min}
                      max={widget.max}
                      step={widget.step}
                      marks={
                        widget.labels === null || widget.labels.length == 0
                          ? true
                          : widget.labels
                      }
                      valueLabelDisplay="auto"
                      disabled
                    />
                  </Box>
                </FormControl>
              )
            } else if (widget.type === "user_attr") {
              return (
                <FormControl key={key} sx={{ margin: theme.spacing(1, 2) }}>
                  <FormLabel>{metricName}</FormLabel>
                  <TextField
                    inputProps={{ readOnly: true }}
                    value={trial.values?.at(i)}
                    disabled
                  />
                </FormControl>
              )
            }
            return null
          })}
        </Card>
      </Box>
    </>
  )
}

const getMetricName = (
  formWidgets: FormWidgets,
  names: string[],
  directions: StudyDirection[],
  i: number
): string => {
  if (formWidgets.output_type == "objective") {
    if (names.at(i) !== undefined) {
      return names[i]
    }
    return directions.length == 1 ? "Objective" : `Objective ${i}`
  } else if (formWidgets.output_type == "user_attr") {
    const key = formWidgets.widgets.at(i)?.user_attr_key
    if (key !== undefined) {
      return key
    }
  }
  console.error("Must not reach here")
  return "Unknown"
}
