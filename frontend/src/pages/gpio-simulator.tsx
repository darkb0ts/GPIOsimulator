import type React from "react"
import { useState, useEffect, useRef } from "react"
import { Switch } from "@/components/ui/switch"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Slider } from "@/components/ui/slider"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Checkbox } from "@/components/ui/checkbox"
import { Textarea } from "@/components/ui/textarea"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion"
import { useTheme } from "@/components/theme-provider"
import {
  BookmarkPlus,
  ChevronDown,
  Download,
  Folder,
  FolderPlus,
  History,
  Layers,
  Moon,
  Play,
  PlayCircle,
  Power,
  RefreshCw,
  Save,
  Send,
  Server,
  Settings,
  Sun,
  Terminal,
  Trash2,
  Upload,
  Wifi,
  WifiOff,
  X,
} from "lucide-react"

interface Pin {
  id: number
  name: string
  state: boolean
  mode: "input" | "output" | "pwm"
  value: number
  pwmValue?: number
  pullUp?: boolean
  pullDown?: boolean
  interrupt?: boolean
  color?: string
  group?: string
  notes?: string
}

interface PinGroup {
  id: string
  name: string
  color: string
  pins: number[]
}

interface LogEntry {
  timestamp: Date
  message: string
  type: "info" | "warning" | "error"
}

interface ApiRequest {
  timestamp: Date
  method: string
  endpoint: string
  payload: string
  response?: string
  status?: string
}

interface PinHistoryEntry {
  timestamp: Date
  pinId: number
  state: boolean
  value: number
}

interface Preset {
  id: string
  name: string
  description: string
  pins: Pin[]
  date: Date
}

interface ScenarioStep {
  id: string
  pinIds: number[]
  action: "on" | "off" | "toggle" | "pwm"
  value?: number
  delay: number
}

interface Scenario {
  id: string
  name: string
  description: string
  steps: ScenarioStep[]
  loop: boolean
}

const PIN_COLORS = [
  "red",
  "green",
  "blue",
  "yellow",
  "purple",
  "pink",
  "orange",
  "cyan",
  "lime",
  "teal",
  "indigo",
  "amber",
]

export default function GpioSimulator() {
  const { theme, setTheme } = useTheme()
  const [pins, setPins] = useState<Pin[]>([])
  const [logs, setLogs] = useState<LogEntry[]>([])
  const [apiRequests, setApiRequests] = useState<ApiRequest[]>([])
  const [pinHistory, setPinHistory] = useState<PinHistoryEntry[]>([])
  const [loggingEnabled, setLoggingEnabled] = useState(true)
  const [historyEnabled, setHistoryEnabled] = useState(true)
  const [selectedPin, setSelectedPin] = useState<Pin | null>(null)
  const [pinCount, setPinCount] = useState(16)
  const [autoRefresh, setAutoRefresh] = useState(false)
  const [connectionType, setConnectionType] = useState<"websocket" | "rest">("rest")
  const [backendUrl, setBackendUrl] = useState("")
  const [isConnected, setIsConnected] = useState(false)
  const [apiEndpoint, setApiEndpoint] = useState("/api/gpio")
  const [apiMethod, setApiMethod] = useState("GET")
  const [apiPayload, setApiPayload] = useState("")
  const [apiResponse, setApiResponse] = useState("")
  const [apiAuthEnabled, setApiAuthEnabled] = useState(false)
  const [apiAuthToken, setApiAuthToken] = useState("")
  const [batchMode, setBatchMode] = useState(false)
  const [selectedPins, setSelectedPins] = useState<number[]>([])
  const [pinGroups, setPinGroups] = useState<PinGroup[]>([])
  const [newGroupName, setNewGroupName] = useState("")
  const [newGroupColor, setNewGroupColor] = useState("green")
  const [presets, setPresets] = useState<Preset[]>([])
  const [newPresetName, setNewPresetName] = useState("")
  const [newPresetDescription, setNewPresetDescription] = useState("")
  const [scenarios, setScenarios] = useState<Scenario[]>([])
  const [activeScenario, setActiveScenario] = useState<Scenario | null>(null)
  const [isRunningScenario, setIsRunningScenario] = useState(false)
  const [newScenarioName, setNewScenarioName] = useState("")
  const [newScenarioDescription, setNewScenarioDescription] = useState("")
  const [newScenarioSteps, setNewScenarioSteps] = useState<ScenarioStep[]>([])
  const [newStepPinIds, setNewStepPinIds] = useState<number[]>([])
  const [newStepAction, setNewStepAction] = useState<"on" | "off" | "toggle" | "pwm">("toggle")
  const [newStepValue, setNewStepValue] = useState(100)
  const [newStepDelay, setNewStepDelay] = useState(1000)
  const [activeTab, setActiveTab] = useState("pins")

  const wsRef = useRef<WebSocket | null>(null)
  const scenarioTimerRef = useRef<NodeJS.Timeout | null>(null)
  type ValidGPIOSpec = {
    model: string;
    validGPIOs: number[];
  };
  
  const VALID_GPIO_LIST: ValidGPIOSpec[] = [
    {
      model: "Raspberry Pi 1 Model B+",
      validGPIOs: [2, 3, 4, 17, 27, 22, 10, 9, 11, 0, 5, 6, 13, 19, 26, 14, 15, 18, 23, 24, 25, 8, 7],
    },
    {
      model: "Raspberry Pi 2 Model B",
      validGPIOs: [2, 3, 4, 17, 27, 22, 10, 9, 11, 5, 6, 13, 19, 26, 14, 15, 18, 23, 24, 25, 8, 7, 12, 16, 20, 21],
    },
    {
      model: "Raspberry Pi 3 Model B+",
      validGPIOs: [2, 3, 4, 17, 27, 22, 10, 9, 11, 5, 6, 13, 19, 26, 14, 15, 18, 23, 24, 25, 8, 7, 12, 16, 20, 21],
    },
    {
      model: "Raspberry Pi 4 Model B",
      validGPIOs: [2, 3, 4, 17, 27, 22, 10, 9, 11, 5, 6, 13, 19, 26, 14, 15, 18, 23, 24, 25, 8, 7, 12, 16, 20, 21],
    },
    {
      model: "Raspberry Pi Zero / Zero W",
      validGPIOs: [2, 3, 4, 17, 27, 22, 10, 9, 11, 5, 6, 13, 19, 26, 14, 15, 18, 23, 24, 25, 8, 7, 12, 16, 20, 21],
    }
  ];
  
  

  // Initialize pins
  useEffect(() => {
    const model: string = "Raspberry Pi 3 Model B+"; // or dynamically selected
    const modelPins = VALID_GPIO_LIST.find(m => m.model === model);
    if (!modelPins) return; // safety check
    console.log(modelPins.validGPIOs)
    const initialPins: Pin[] = modelPins.validGPIOs.map((gpio, i) => ({
      id: gpio,
      name: `GPIO ${gpio}`,
      state: false,
      mode: "output",
      value: 0,
      pwmValue: 0,
      color: PIN_COLORS[i % PIN_COLORS.length],
    }));
    setPins(initialPins)
    addLog("System initialized", "info")
  }, [pinCount])

  // Auto refresh simulation
  useEffect(() => {
    let interval: NodeJS.Timeout
    if (autoRefresh) {
      interval = setInterval(() => {
        refreshPinStates()
      }, 2000)
    }
    return () => clearInterval(interval)
  }, [autoRefresh, pins])

  // WebSocket connection management
  useEffect(() => {
    if (connectionType === "websocket" && backendUrl && isConnected) {
      connectWebSocket()
    }

    return () => {
      if (wsRef.current) {
        wsRef.current.close()
        wsRef.current = null
      }
    }
  }, [connectionType, backendUrl, isConnected])

  // Clean up scenario timer on unmount
  useEffect(() => {
    return () => {
      if (scenarioTimerRef.current) {
        clearTimeout(scenarioTimerRef.current)
      }
    }
  }, [])

  const connectWebSocket = () => {
    if (!backendUrl) {
      addLog("WebSocket URL is required", "error")
      return
    }

    try {
      wsRef.current = new WebSocket(backendUrl)

      wsRef.current.onopen = () => {
        addLog("WebSocket connected", "info")
        setIsConnected(true)
      }

      wsRef.current.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data)
          addLog(`WebSocket message received: ${JSON.stringify(data).substring(0, 100)}`, "info")

          // Handle pin updates from server
          if (data.type === "pinUpdate" && data.pins) {
            updatePinsFromServer(data.pins)
          }

          setApiResponse(JSON.stringify(data, null, 2))

          // Add to request history
          setApiRequests((prev) => [
            {
              timestamp: new Date(),
              method: "WS RECEIVE",
              endpoint: backendUrl,
              payload: "",
              response: JSON.stringify(data, null, 2),
              status: "success",
            },
            ...prev.slice(0, 19),
          ])
        } catch (error) {
          addLog(`Failed to parse WebSocket message: ${error}`, "error")
        }
      }

      wsRef.current.onclose = () => {
        addLog("WebSocket disconnected", "warning")
        setIsConnected(false)
      }

      wsRef.current.onerror = (error) => {
        addLog(`WebSocket error: ${error}`, "error")
        setIsConnected(false)
      }
    } catch (error) {
      addLog(`Failed to connect WebSocket: ${error}`, "error")
      setIsConnected(false)
    }
  }

  const disconnectWebSocket = () => {
    if (wsRef.current) {
      wsRef.current.close()
      wsRef.current = null
      setIsConnected(false)
      addLog("WebSocket disconnected", "info")
    }
  }

  const toggleConnection = () => {
    if (isConnected) {
      if (connectionType === "websocket") {
        disconnectWebSocket()
      }
      setIsConnected(false)
    } else {
      if (connectionType === "websocket") {
        connectWebSocket()
      } else {
        // For REST, we just mark as connected since there's no persistent connection
        setIsConnected(true)
        addLog("REST API connection enabled", "info")
      }
    }
  }

  const sendApiRequest = async () => {
    if (!backendUrl) {
      addLog("Backend URL is required", "error")
      return
    }

    const url = `${backendUrl}${apiEndpoint}`
    const requestPayload = apiPayload || JSON.stringify({ pins: getPinsForApi() })

    try {
      if (connectionType === "websocket") {
        if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
          wsRef.current.send(requestPayload)
          addLog(`WebSocket message sent: ${requestPayload.substring(0, 100)}`, "info")

          // Add to request history
          setApiRequests((prev) => [
            {
              timestamp: new Date(),
              method: "WS SEND",
              endpoint: backendUrl,
              payload: requestPayload,
              status: "sent",
            },
            ...prev.slice(0, 19),
          ])
        } else {
          addLog("WebSocket is not connected", "error")
        }
      } else {
        // REST API request
        const headers: HeadersInit = {
          "Content-Type": "application/json",
        }

        if (apiAuthEnabled && apiAuthToken) {
          headers["Authorization"] = `Bearer ${apiAuthToken}`
        }

        const response = await fetch(url, {
          method: apiMethod,
          headers,
          body: ["GET", "HEAD"].includes(apiMethod) ? undefined : requestPayload,
        })

        const responseText = await response.text()
        let responseData

        try {
          responseData = JSON.parse(responseText)
          setApiResponse(JSON.stringify(responseData, null, 2))
        } catch {
          setApiResponse(responseText)
          responseData = responseText
        }

        const status = response.ok ? "success" : "error"
        addLog(
          `API ${apiMethod} request to ${url}: ${status} (${response.status})`,
          status === "success" ? "info" : "error",
        )

        // Add to request history
        setApiRequests((prev) => [
          {
            timestamp: new Date(),
            method: apiMethod,
            endpoint: url,
            payload: requestPayload,
            response: JSON.stringify(responseData, null, 2),
            status: response.status.toString(),
          },
          ...prev.slice(0, 19),
        ])

        // Handle pin updates from server
        if (response.ok && responseData && responseData.pins) {
          updatePinsFromServer(responseData.pins)
        }
      }
    } catch (error) {
      addLog(`API request failed: ${error}`, "error")
      setApiResponse(`Error: ${error}`)

      // Add to request history
      setApiRequests((prev) => [
        {
          timestamp: new Date(),
          method: connectionType === "websocket" ? "WS SEND" : apiMethod,
          endpoint: url,
          payload: requestPayload,
          status: "failed",
          response: `Error: ${error}`,
        },
        ...prev.slice(0, 19),
      ])
    }
  }

  const updatePinsFromServer = (serverPins: any[]) => {
    setPins((currentPins) => {
      return currentPins.map((pin) => {
        const serverPin = serverPins.find((sp) => sp.id === pin.id || sp.name === pin.name)
        if (serverPin) {
          return {
            ...pin,
            state: serverPin.state ?? pin.state,
            value: serverPin.value ?? pin.value,
            mode: serverPin.mode ?? pin.mode,
            pwmValue: serverPin.pwmValue ?? pin.pwmValue,
          }
        }
        return pin
      })
    })
    addLog("Pins updated from server", "info")
  }

  const getPinsForApi = () => {
    if (batchMode && selectedPins.length > 0) {
      return pins.filter((pin) => selectedPins.includes(pin.id))
    }
    return selectedPin ? [selectedPin] : pins
  }

  const togglePin = (id: number) => {
    setPins(
      pins.map((pin) => {
        if (pin.id === id) {
          const newState = !pin.state
          if (loggingEnabled) {
            addLog(`Pin ${pin.name} turned ${newState ? "ON" : "OFF"}`, "info")
          }

          // Add to pin history
          if (historyEnabled) {
            addPinHistory(id, newState, newState ? 1 : 0)
          }

          return { ...pin, state: newState, value: newState ? 1 : 0 }
        }
        return pin
      }),
    )
  }

  const updatePinMode = (id: number, mode: "input" | "output" | "pwm") => {
    setPins(
      pins.map((pin) => {
        if (pin.id === id) {
          if (loggingEnabled) {
            addLog(`Pin ${pin.name} mode changed to ${mode}`, "info")
          }
          return { ...pin, mode }
        }
        return pin
      }),
    )
  }

  const updatePinPwm = (id: number, pwmValue: number) => {
    setPins(
      pins.map((pin) => {
        if (pin.id === id) {
          if (loggingEnabled) {
            addLog(`Pin ${pin.name} PWM value set to ${pwmValue}%`, "info")
          }

          // Add to pin history
          if (historyEnabled) {
            addPinHistory(id, pwmValue > 0, pwmValue > 0 ? 1 : 0)
          }

          return { ...pin, pwmValue, state: pwmValue > 0, value: pwmValue > 0 ? 1 : 0 }
        }
        return pin
      }),
    )
  }

  const updatePinConfig = (id: number, config: Partial<Pin>) => {
    setPins(
      pins.map((pin) => {
        if (pin.id === id) {
          if (loggingEnabled) {
            addLog(`Pin ${pin.name} configuration updated`, "info")
          }
          return { ...pin, ...config }
        }
        return pin
      }),
    )
    if (selectedPin?.id === id) {
      setSelectedPin((prev) => (prev ? { ...prev, ...config } : null))
    }
  }

  const addLog = (message: string, type: "info" | "warning" | "error" = "info") => {
    if (loggingEnabled) {
      setLogs((prevLogs) => [
        { timestamp: new Date(), message, type },
        ...prevLogs.slice(0, 99), // Keep only the last 100 logs
      ])
    }
  }

  const addPinHistory = (pinId: number, state: boolean, value: number) => {
    if (historyEnabled) {
      setPinHistory((prev) => [
        { timestamp: new Date(), pinId, state, value },
        ...prev.slice(0, 999), // Keep last 1000 history entries
      ])
    }
  }

  const clearLogs = () => {
    setLogs([])
    addLog("Logs cleared", "info")
  }

  const clearHistory = () => {
    setPinHistory([])
    addLog("Pin history cleared", "info")
  }

  const refreshPinStates = () => {
    // Simulate reading pin states from hardware
    setPins((currentPins) =>
      currentPins.map((pin) => {
        if (pin.mode === "input") {
          // Simulate random input changes occasionally
          if (Math.random() > 0.7) {
            const newState = Math.random() > 0.5
            addLog(`Input pin ${pin.name} changed to ${newState ? "HIGH" : "LOW"}`, "info")

            // Add to pin history
            if (historyEnabled) {
              addPinHistory(pin.id, newState, newState ? 1 : 0)
            }

            return { ...pin, state: newState, value: newState ? 1 : 0 }
          }
        }
        return pin
      }),
    )
    addLog("Pin states refreshed", "info")
  }

  const exportLogs = () => {
    const logText = logs
      .map((log) => `[${log.timestamp.toISOString()}] [${log.type.toUpperCase()}] ${log.message}`)
      .join("\n")

    const blob = new Blob([logText], { type: "text/plain" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `gpio-logs-${new Date().toISOString().slice(0, 19).replace(/:/g, "-")}.txt`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)


    addLog("Logs exported", "info")
  }

  const exportHistory = () => {
    const historyText = JSON.stringify(pinHistory, null, 2)
    const blob = new Blob([historyText], { type: "application/json" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `gpio-history-${new Date().toISOString().slice(0, 19).replace(/:/g, "-")}.json`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)

    addLog("Pin history exported", "info")
  }

  const saveConfiguration = () => {
    const config = JSON.stringify(pins, null, 2)
    const blob = new Blob([config], { type: "application/json" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `gpio-config-${new Date().toISOString().slice(0, 19).replace(/:/g, "-")}.json`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)

    addLog("Configuration saved", "info")
  }

  const importConfiguration = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    const reader = new FileReader()
    reader.onload = (e) => {
      try {
        const config = JSON.parse(e.target?.result as string)
        if (Array.isArray(config)) {
          setPins(config)
          addLog("Configuration imported successfully", "info")
        } else {
          addLog("Invalid configuration format", "error")
        }
      } catch (error) {
        addLog(`Failed to import configuration: ${error}`, "error")
      }
    }
    reader.readAsText(file)
  }

  const togglePinSelection = (id: number) => {
    setSelectedPins((prev) => {
      if (prev.includes(id)) {
        return prev.filter((pinId) => pinId !== id)
      } else {
        return [...prev, id]
      }
    })
  }

  const toggleAllPins = () => {
    if (selectedPins.length === pins.length) {
      setSelectedPins([])
    } else {
      setSelectedPins(pins.map((pin) => pin.id))
    }
  }

  const createPinGroup = () => {
    if (!newGroupName) {
      addLog("Group name is required", "error")
      return
    }

    if (selectedPins.length === 0) {
      addLog("No pins selected for the group", "error")
      return
    }

    const groupId = `group-${Date.now()}`
    const newGroup: PinGroup = {
      id: groupId,
      name: newGroupName,
      color: newGroupColor,
      pins: [...selectedPins],
    }

    setPinGroups((prev) => [...prev, newGroup])

    // Update pins with group info
    setPins(
      pins.map((pin) => {
        if (selectedPins.includes(pin.id)) {
          return { ...pin, group: groupId }
        }
        return pin
      }),
    )

    setNewGroupName("")
    addLog(`Created pin group: ${newGroupName} with ${selectedPins.length} pins`, "info")
  }

  const deleteGroup = (groupId: string) => {
    setPinGroups((prev) => prev.filter((group) => group.id !== groupId))

    // Remove group from pins
    setPins(
      pins.map((pin) => {
        if (pin.group === groupId) {
          return { ...pin, group: undefined }
        }
        return pin
      }),
    )

    addLog(`Deleted pin group`, "info")
  }

  const savePreset = () => {
    if (!newPresetName) {
      addLog("Preset name is required", "error")
      return
    }

    const presetId = `preset-${Date.now()}`
    const newPreset: Preset = {
      id: presetId,
      name: newPresetName,
      description: newPresetDescription,
      pins: [...pins],
      date: new Date(),
    }

    setPresets((prev) => [...prev, newPreset])
    setNewPresetName("")
    setNewPresetDescription("")
    addLog(`Saved preset: ${newPresetName}`, "info")
  }

  const loadPreset = (preset: Preset) => {
    setPins(preset.pins)
    addLog(`Loaded preset: ${preset.name}`, "info")
  }

  const deletePreset = (presetId: string) => {
    setPresets((prev) => prev.filter((preset) => preset.id !== presetId))
    addLog("Deleted preset", "info")
  }

  const addScenarioStep = () => {
    if (newStepPinIds.length === 0) {
      addLog("No pins selected for the step", "error")
      return
    }

    const stepId = `step-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`
    const newStep: ScenarioStep = {
      id: stepId,
      pinIds: [...newStepPinIds],
      action: newStepAction,
      value: newStepAction === "pwm" ? newStepValue : undefined,
      delay: newStepDelay,
    }

    setNewScenarioSteps((prev) => [...prev, newStep])
    setNewStepPinIds([])
    addLog(`Added scenario step: ${newStepAction} with ${newStepPinIds.length} pins`, "info")
  }

  const removeScenarioStep = (stepId: string) => {
    setNewScenarioSteps((prev) => prev.filter((step) => step.id !== stepId))
  }

  const saveScenario = () => {
    if (!newScenarioName) {
      addLog("Scenario name is required", "error")
      return
    }

    if (newScenarioSteps.length === 0) {
      addLog("Scenario must have at least one step", "error")
      return
    }

    const scenarioId = `scenario-${Date.now()}`
    const newScenario: Scenario = {
      id: scenarioId,
      name: newScenarioName,
      description: newScenarioDescription,
      steps: [...newScenarioSteps],
      loop: false,
    }

    setScenarios((prev) => [...prev, newScenario])
    setNewScenarioName("")
    setNewScenarioDescription("")
    setNewScenarioSteps([])
    addLog(`Saved scenario: ${newScenarioName} with ${newScenarioSteps.length} steps`, "info")
  }

  const deleteScenario = (scenarioId: string) => {
    setScenarios((prev) => prev.filter((scenario) => scenario.id !== scenarioId))
    addLog("Deleted scenario", "info")
  }

  const runScenario = (scenario: Scenario) => {
    if (isRunningScenario) {
      stopScenario()
      return
    }

    setActiveScenario(scenario)
    setIsRunningScenario(true)
    addLog(`Running scenario: ${scenario.name}`, "info")

    // Start with the first step
    executeScenarioStep(scenario, 0)
  }

  const executeScenarioStep = (scenario: Scenario, stepIndex: number) => {
    if (!isRunningScenario || stepIndex >= scenario.steps.length) {
      if (scenario.loop && isRunningScenario) {
        // If looping, start over
        addLog(`Looping scenario: ${scenario.name}`, "info")
        executeScenarioStep(scenario, 0)
      } else {
        // Otherwise, stop the scenario
        stopScenario()
      }
      return
    }

    const step = scenario.steps[stepIndex]

    // Execute the step action on all pins in the step
    setPins((currentPins) => {
      return currentPins.map((pin) => {
        if (step.pinIds.includes(pin.id)) {
          switch (step.action) {
            case "on":
              addPinHistory(pin.id, true, 1)
              return { ...pin, state: true, value: 1 }
            case "off":
              addPinHistory(pin.id, false, 0)
              return { ...pin, state: false, value: 0 }
            case "toggle":
              const newState = !pin.state
              addPinHistory(pin.id, newState, newState ? 1 : 0)
              return { ...pin, state: newState, value: newState ? 1 : 0 }
            case "pwm":
              if (pin.mode === "pwm" && step.value !== undefined) {
                addPinHistory(pin.id, step.value > 0, step.value > 0 ? 1 : 0)
                return {
                  ...pin,
                  pwmValue: step.value,
                  state: step.value > 0,
                  value: step.value > 0 ? 1 : 0,
                }
              }
              return pin
            default:
              return pin
          }
        }
        return pin
      })
    })

    addLog(`Executed step ${stepIndex + 1} of scenario: ${scenario.name}`, "info")

    // Schedule the next step
    scenarioTimerRef.current = setTimeout(() => {
      executeScenarioStep(scenario, stepIndex + 1)
    }, step.delay)
  }

  const stopScenario = () => {
    if (scenarioTimerRef.current) {
      clearTimeout(scenarioTimerRef.current)
      scenarioTimerRef.current = null
    }

    setIsRunningScenario(false)
    setActiveScenario(null)
    addLog("Stopped scenario execution", "info")
  }

  const getPinsByGroup = (groupId: string) => {
    return pins.filter((pin) => pin.group === groupId)
  }

  const getGroupForPin = (pinId: number) => {
    const pin = pins.find((p) => p.id === pinId)
    if (pin?.group) {
      return pinGroups.find((group) => group.id === pin.group)
    }
    return null
  }

  const getPinColor = (pin: Pin) => {
    if (pin.color) {
      return pin.color
    }

    const group = getGroupForPin(pin.id)
    if (group) {
      return group.color
    }

    return PIN_COLORS[pin.id % PIN_COLORS.length]
  }

  const getColorClass = (color: string) => {
    const colorMap: Record<string, string> = {
      red: "bg-red-500 hover:bg-red-600",
      green: "bg-green-500 hover:bg-green-600",
      blue: "bg-blue-500 hover:bg-blue-600",
      yellow: "bg-yellow-500 hover:bg-yellow-600",
      purple: "bg-purple-500 hover:bg-purple-600",
      pink: "bg-pink-500 hover:bg-pink-600",
      orange: "bg-orange-500 hover:bg-orange-600",
      cyan: "bg-cyan-500 hover:bg-cyan-600",
      lime: "bg-lime-500 hover:bg-lime-600",
      teal: "bg-teal-500 hover:bg-teal-600",
      indigo: "bg-indigo-500 hover:bg-indigo-600",
      amber: "bg-amber-500 hover:bg-amber-600",
    }

    return colorMap[color] || "bg-gray-500 hover:bg-gray-600"
  }

  const getBorderColorClass = (color: string) => {
    const colorMap: Record<string, string> = {
      red: "border-red-500",
      green: "border-green-500",
      blue: "border-blue-500",
      yellow: "border-yellow-500",
      purple: "border-purple-500",
      pink: "border-pink-500",
      orange: "border-orange-500",
      cyan: "border-cyan-500",
      lime: "border-lime-500",
      teal: "border-teal-500",
      indigo: "border-indigo-500",
      amber: "border-amber-500",
    }

    return colorMap[color] || "border-gray-500"
  }

  const getTextColorClass = (color: string) => {
    const colorMap: Record<string, string> = {
      red: "text-red-500",
      green: "text-green-500",
      blue: "text-blue-500",
      yellow: "text-yellow-500",
      purple: "text-purple-500",
      pink: "text-pink-500",
      orange: "text-orange-500",
      cyan: "text-cyan-500",
      lime: "text-lime-500",
      teal: "text-teal-500",
      indigo: "text-indigo-500",
      amber: "text-amber-500",
    }

    return colorMap[color] || "text-gray-500"
  }

  return (
    <div className="flex flex-col h-screen w-full">
      {/* Header with theme toggle and tabs */}
      <div className="flex justify-between items-center p-4 border-b bg-background">
        <h2 className="text-2xl font-bold">GPIO Simulator</h2>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <Badge variant={isRunningScenario ? "default" : "outline"} className="animate-pulse">
              {isRunningScenario ? "Running Scenario" : "Idle"}
            </Badge>
            <Badge variant={isConnected ? "default" : "outline"}>{isConnected ? "Connected" : "Disconnected"}</Badge>
          </div>
          <Button variant="outline" size="icon" onClick={() => setTheme(theme === "dark" ? "light" : "dark")}>
            {theme === "dark" ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
          </Button>
        </div>
      </div>

      <div className="flex-1 flex flex-col md:flex-row overflow-hidden">
        {/* Left sidebar - Navigation */}
        <div className="w-full md:w-64 border-r bg-muted/30">
          <div className="p-2">
            <div className="grid grid-cols-2 md:grid-cols-1 gap-2">
              <Button
                variant={activeTab === "pins" ? "default" : "ghost"}
                className="justify-start"
                onClick={() => setActiveTab("pins")}
              >
                <Layers className="h-4 w-4 mr-2" />
                GPIO Pins
              </Button>
              <Button
                variant={activeTab === "groups" ? "default" : "ghost"}
                className="justify-start"
                onClick={() => setActiveTab("groups")}
              >
                <Folder className="h-4 w-4 mr-2" />
                Pin Groups
              </Button>
              <Button
                variant={activeTab === "presets" ? "default" : "ghost"}
                className="justify-start"
                onClick={() => setActiveTab("presets")}
              >
                <BookmarkPlus className="h-4 w-4 mr-2" />
                Presets
              </Button>
              <Button
                variant={activeTab === "scenarios" ? "default" : "ghost"}
                className="justify-start"
                onClick={() => setActiveTab("scenarios")}
              >
                <PlayCircle className="h-4 w-4 mr-2" />
                Scenarios
              </Button>
              <Button
                variant={activeTab === "history" ? "default" : "ghost"}
                className="justify-start"
                onClick={() => setActiveTab("history")}
              >
                <History className="h-4 w-4 mr-2" />
                History
              </Button>
              <Button
                variant={activeTab === "api" ? "default" : "ghost"}
                className="justify-start"
                onClick={() => setActiveTab("api")}
              >
                <Server className="h-4 w-4 mr-2" />
                API
              </Button>
              <Button
                variant={activeTab === "logs" ? "default" : "ghost"}
                className="justify-start"
                onClick={() => setActiveTab("logs")}
              >
                <Terminal className="h-4 w-4 mr-2" />
                Logs
              </Button>
              <Button
                variant={activeTab === "settings" ? "default" : "ghost"}
                className="justify-start"
                onClick={() => setActiveTab("settings")}
              >
                <Settings className="h-4 w-4 mr-2" />
                Settings
              </Button>
            </div>
          </div>
        </div>

        {/* Main content area */}
        <div className="flex-1 overflow-auto p-4">
          {/* Pins Tab */}
          {activeTab === "pins" && (
            <div className="space-y-6">
              <div className="flex justify-between items-center">
                <h3 className="text-xl font-bold">GPIO Pins</h3>
                <div className="flex items-center gap-2">
                  <Button variant="outline" size="sm" onClick={refreshPinStates}>
                    <RefreshCw className="h-4 w-4 mr-1" />
                    Refresh
                  </Button>
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="auto-refresh"
                      checked={autoRefresh}
                      onCheckedChange={(checked) => setAutoRefresh(checked as boolean)}
                    />
                    <Label htmlFor="auto-refresh">Auto</Label>
                  </div>
                  {batchMode && (
                    <Button variant="outline" size="sm" onClick={toggleAllPins}>
                      {selectedPins.length === pins.length ? "Deselect All" : "Select All"}
                    </Button>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
                {pins.map((pin) => {
                  const pinColor = getPinColor(pin)
                  const group = getGroupForPin(pin.id)

                  return (
                    <Card
                      key={pin.id}
                      className={`cursor-pointer transition-colors ${
                        pin.state
                          ? "border-green-500 bg-green-50 dark:bg-green-950/30"
                          : "border-gray-200 dark:border-gray-800"
                      } ${selectedPin?.id === pin.id ? "ring-2 ring-offset-2 ring-blue-500" : ""} ${
                        batchMode && selectedPins.includes(pin.id) ? "ring-2 ring-offset-2 ring-purple-500" : ""
                      } ${group ? getBorderColorClass(group.color) : ""}`}
                      onClick={() => (batchMode ? togglePinSelection(pin.id) : setSelectedPin(pin))}
                    >
                      <CardHeader className="p-3">
                        <CardTitle className="text-sm flex justify-between items-center">
                          <span className={group ? getTextColorClass(group.color) : ""}>{pin.name}</span>
                          <Badge
                            variant={pin.mode === "input" ? "outline" : pin.mode === "pwm" ? "secondary" : "default"}
                          >
                            {pin.mode}
                          </Badge>
                        </CardTitle>
                        {group && (
                          <Badge variant="outline" className={`text-xs ${getTextColorClass(group.color)}`}>
                            {group.name}
                          </Badge>
                        )}
                      </CardHeader>
                      <CardContent className="p-3 pt-0">
                        <div className="flex justify-between items-center">
                          <span className="text-xs">
                            {pin.mode === "pwm" ? `${pin.pwmValue}%` : pin.state ? "HIGH" : "LOW"}
                          </span>
                          <Button
                            variant={pin.state ? "default" : "outline"}
                            size="icon"
                            className={`h-8 w-8 ${pin.state ? getColorClass(pinColor) : ""}`}
                            onClick={(e) => {
                              e.stopPropagation()
                              togglePin(pin.id)
                            }}
                            disabled={pin.mode === "input"}
                          >
                            <Power className={`h-4 w-4 ${pin.state ? "text-white" : ""}`} />
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  )
                })}
              </div>

              {/* Pin Configuration */}
              {selectedPin && !batchMode && (
                <Card className="mt-6">
                  <CardHeader>
                    <CardTitle className="flex justify-between items-center">
                      <span>Configure {selectedPin.name}</span>
                      <Button variant="ghost" size="icon" onClick={() => setSelectedPin(null)}>
                        <X className="h-4 w-4" />
                      </Button>
                    </CardTitle>
                    <CardDescription>Adjust settings for the selected pin</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="grid gap-6">
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div className="space-y-2">
                          <Label htmlFor="pin-name">Pin Name</Label>
                          <Input
                            id="pin-name"
                            value={selectedPin.name}
                            onChange={(e) => updatePinConfig(selectedPin.id, { name: e.target.value })}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="pin-mode">Mode</Label>
                          <Select
                            value={selectedPin.mode}
                            onValueChange={(value) =>
                              updatePinMode(selectedPin.id, value as "input" | "output" | "pwm")
                            }
                          >
                            <SelectTrigger id="pin-mode">
                              <SelectValue placeholder="Select mode" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="input">Input</SelectItem>
                              <SelectItem value="output">Output</SelectItem>
                              <SelectItem value="pwm">PWM</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="pin-color">Color</Label>
                          <Select
                            value={selectedPin.color || PIN_COLORS[selectedPin.id % PIN_COLORS.length]}
                            onValueChange={(value) => updatePinConfig(selectedPin.id, { color: value })}
                          >
                            <SelectTrigger id="pin-color">
                              <SelectValue placeholder="Select color" />
                            </SelectTrigger>
                            <SelectContent>
                              {PIN_COLORS.map((color) => (
                                <SelectItem key={color} value={color}>
                                  <div className="flex items-center">
                                    <div className={`w-4 h-4 rounded-full mr-2 ${getColorClass(color)}`}></div>
                                    {color.charAt(0).toUpperCase() + color.slice(1)}
                                  </div>
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      </div>

                      {selectedPin.mode === "pwm" && (
                        <div className="space-y-2">
                          <div className="flex justify-between">
                            <Label htmlFor="pwm-value">PWM Value: {selectedPin.pwmValue}%</Label>
                          </div>
                          <Slider
                            id="pwm-value"
                            min={0}
                            max={100}
                            step={1}
                            value={[selectedPin.pwmValue || 0]}
                            onValueChange={(value) => updatePinPwm(selectedPin.id, value[0])}
                          />
                        </div>
                      )}

                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div className="flex items-center space-x-2">
                          <Checkbox
                            id="pull-up"
                            checked={selectedPin.pullUp}
                            onCheckedChange={(checked) =>
                              updatePinConfig(selectedPin.id, {
                                pullUp: checked as boolean,
                                pullDown: checked ? false : selectedPin.pullDown,
                              })
                            }
                            disabled={selectedPin.mode === "output"}
                          />
                          <Label htmlFor="pull-up">Pull-Up Resistor</Label>
                        </div>
                        <div className="flex items-center space-x-2">
                          <Checkbox
                            id="pull-down"
                            checked={selectedPin.pullDown}
                            onCheckedChange={(checked) =>
                              updatePinConfig(selectedPin.id, {
                                pullDown: checked as boolean,
                                pullUp: checked ? false : selectedPin.pullUp,
                              })
                            }
                            disabled={selectedPin.mode === "output"}
                          />
                          <Label htmlFor="pull-down">Pull-Down Resistor</Label>
                        </div>
                        <div className="flex items-center space-x-2">
                          <Checkbox
                            id="interrupt"
                            checked={selectedPin.interrupt}
                            onCheckedChange={(checked) =>
                              updatePinConfig(selectedPin.id, { interrupt: checked as boolean })
                            }
                            disabled={selectedPin.mode !== "input"}
                          />
                          <Label htmlFor="interrupt">Enable Interrupt</Label>
                        </div>
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="pin-notes">Notes</Label>
                        <Textarea
                          id="pin-notes"
                          value={selectedPin.notes || ""}
                          onChange={(e) => updatePinConfig(selectedPin.id, { notes: e.target.value })}
                          placeholder="Add notes about this pin..."
                        />
                      </div>
                    </div>
                  </CardContent>
                  <CardFooter className="flex justify-between">
                    <Button
                      variant="outline"
                      onClick={() => {
                        togglePin(selectedPin.id)
                      }}
                      disabled={selectedPin.mode === "input"}
                    >
                      Toggle State
                    </Button>
                    <Button
                      onClick={() => {
                        if (selectedPin.mode === "output") {
                          updatePinConfig(selectedPin.id, { state: true, value: 1 })
                        } else if (selectedPin.mode === "pwm") {
                          updatePinPwm(selectedPin.id, 100)
                        }
                      }}
                      disabled={selectedPin.mode === "input"}
                    >
                      Set High
                    </Button>
                  </CardFooter>
                </Card>
              )}
            </div>
          )}

          {/* Groups Tab */}
          {activeTab === "groups" && (
            <div className="space-y-6">
              <div className="flex justify-between items-center">
                <h3 className="text-xl font-bold">Pin Groups</h3>
                <Dialog>
                  <DialogTrigger asChild>
                    <Button>
                    <FolderPlus className="h-4 w-4 mr-2 shadow-md text-black dark:text-white transition-colors duration-300" />
                      New Group
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Create Pin Group</DialogTitle>
                      <DialogDescription>Group pins together for easier management and control.</DialogDescription>
                    </DialogHeader>
                    <div className="grid gap-4 py-4">
                      <div className="space-y-2">
                        <Label htmlFor="group-name">Group Name</Label>
                        <Input
                          id="group-name"
                          value={newGroupName}
                          onChange={(e) => setNewGroupName(e.target.value)}
                          placeholder="Enter group name"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="group-color">Group Color</Label>
                        <Select value={newGroupColor} onValueChange={setNewGroupColor}>
                          <SelectTrigger id="group-color">
                            <SelectValue placeholder="Select color" />
                          </SelectTrigger>
                          <SelectContent>
                            {PIN_COLORS.map((color) => (
                              <SelectItem key={color} value={color}>
                                <div className="flex items-center">
                                  <div className={`w-4 h-4 rounded-full mr-2 ${getColorClass(color)}`}></div>
                                  {color.charAt(0).toUpperCase() + color.slice(1)}
                                </div>
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label>Select Pins</Label>
                        <div className="border rounded-md p-2 h-40 overflow-auto">
                          <div className="grid grid-cols-3 gap-2">
                            {pins.map((pin) => (
                              <div key={pin.id} className="flex items-center space-x-2">
                                <Checkbox
                                  id={`select-pin-${pin.id}`}
                                  checked={selectedPins.includes(pin.id)}
                                  onCheckedChange={(checked) => {
                                    if (checked) {
                                      setSelectedPins((prev) => [...prev, pin.id])
                                    } else {
                                      setSelectedPins((prev) => prev.filter((id) => id !== pin.id))
                                    }
                                  }}
                                />
                                <Label htmlFor={`select-pin-${pin.id}`}>{pin.name}</Label>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>
                    <DialogFooter>
                      <Button onClick={createPinGroup}>Create Group</Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              </div>

              {pinGroups.length === 0 ? (
                <div className="text-center py-12 border rounded-lg bg-muted/20">
                  <Folder className="h-12 w-12 mx-auto text-muted-foreground" />
                  <h3 className="mt-4 text-lg font-medium">No Groups Created</h3>
                  <p className="mt-2 text-sm text-muted-foreground">
                    Create a group to organize and control multiple pins together.
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {pinGroups.map((group) => {
                    const groupPins = getPinsByGroup(group.id)
                    return (
                      <Card key={group.id} className={`border-l-4 ${getBorderColorClass(group.color)}`}>
                        <CardHeader>
                          <CardTitle className="flex justify-between items-center">
                            <span className={getTextColorClass(group.color)}>{group.name}</span>
                            <Button variant="ghost" size="icon" onClick={() => deleteGroup(group.id)}>
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </CardTitle>
                          <CardDescription>{groupPins.length} pins</CardDescription>
                        </CardHeader>
                        <CardContent>
                          <div className="grid grid-cols-3 gap-2">
                            {groupPins.map((pin) => (
                              <Badge
                                key={pin.id}
                                variant={pin.state ? "default" : "outline"}
                                className={pin.state ? getColorClass(group.color) : ""}
                              >
                                {pin.name}
                              </Badge>
                            ))}
                          </div>
                        </CardContent>
                        <CardFooter className="flex justify-between">
                          <Button
                            variant="outline"
                            onClick={() => {
                              groupPins.forEach((pin) => {
                                if (pin.mode !== "input") {
                                  togglePin(pin.id)
                                }
                              })
                            }}
                          >
                            Toggle All
                          </Button>
                          <Button
                            onClick={() => {
                              groupPins.forEach((pin) => {
                                if (pin.mode === "output") {
                                  updatePinConfig(pin.id, { state: true, value: 1 })
                                } else if (pin.mode === "pwm") {
                                  updatePinPwm(pin.id, 100)
                                }
                              })
                            }}
                          >
                            Set All High
                          </Button>
                        </CardFooter>
                      </Card>
                    )
                  })}
                </div>
              )}
            </div>
          )}

          {/* Presets Tab */}
          {activeTab === "presets" && (
            <div className="space-y-6">
              <div className="flex justify-between items-center">
                <h3 className="text-xl font-bold">Presets</h3>
                <Dialog>
                  <DialogTrigger asChild>
                    <Button>
                      <BookmarkPlus className="h-4 w-4 mr-2" />
                      Save Current State
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Save Preset</DialogTitle>
                      <DialogDescription>
                        Save the current pin configuration as a preset for future use.
                      </DialogDescription>
                    </DialogHeader>
                    <div className="grid gap-4 py-4">
                      <div className="space-y-2">
                        <Label htmlFor="preset-name">Preset Name</Label>
                        <Input
                          id="preset-name"
                          value={newPresetName}
                          onChange={(e) => setNewPresetName(e.target.value)}
                          placeholder="Enter preset name"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="preset-description">Description (Optional)</Label>
                        <Textarea
                          id="preset-description"
                          value={newPresetDescription}
                          onChange={(e) => setNewPresetDescription(e.target.value)}
                          placeholder="Enter description"
                        />
                      </div>
                    </div>
                    <DialogFooter>
                      <Button onClick={savePreset}>Save Preset</Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              </div>

              {presets.length === 0 ? (
                <div className="text-center py-12 border rounded-lg bg-muted/20">
                  <BookmarkPlus className="h-12 w-12 mx-auto text-muted-foreground" />
                  <h3 className="mt-4 text-lg font-medium">No Presets Saved</h3>
                  <p className="mt-2 text-sm text-muted-foreground">
                    Save the current pin configuration as a preset for quick access later.
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {presets.map((preset) => (
                    <Card key={preset.id}>
                      <CardHeader>
                        <CardTitle className="flex justify-between items-center">
                          <span>{preset.name}</span>
                          <Button variant="ghost" size="icon" onClick={() => deletePreset(preset.id)}>
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </CardTitle>
                        <CardDescription>
                          {preset.date.toLocaleDateString()} {preset.date.toLocaleTimeString()}
                        </CardDescription>
                      </CardHeader>
                      <CardContent>
                        <p className="text-sm text-muted-foreground line-clamp-2">
                          {preset.description || "No description provided."}
                        </p>
                        <div className="mt-2">
                          <Badge variant="outline">{preset.pins.length} pins</Badge>
                          <Badge variant="outline" className="ml-2">
                            {preset.pins.filter((p) => p.state).length} active
                          </Badge>
                        </div>
                      </CardContent>
                      <CardFooter>
                        <Button onClick={() => loadPreset(preset)} className="w-full">
                          Load Preset
                        </Button>
                      </CardFooter>
                    </Card>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Scenarios Tab */}
          {activeTab === "scenarios" && (
            <div className="space-y-6">
              <div className="flex justify-between items-center">
                <h3 className="text-xl font-bold">Scenarios</h3>
                <Dialog>
                  <DialogTrigger asChild>
                    <Button>
                      <PlayCircle className="h-4 w-4 mr-2" />
                      Create Scenario
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="max-w-3xl">
                    <DialogHeader>
                      <DialogTitle>Create Scenario</DialogTitle>
                      <DialogDescription>
                        Create a sequence of pin operations that can be executed automatically.
                      </DialogDescription>
                    </DialogHeader>
                    <div className="grid gap-4 py-4">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label htmlFor="scenario-name">Scenario Name</Label>
                          <Input
                            id="scenario-name"
                            value={newScenarioName}
                            onChange={(e) => setNewScenarioName(e.target.value)}
                            placeholder="Enter scenario name"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="scenario-description">Description (Optional)</Label>
                          <Input
                            id="scenario-description"
                            value={newScenarioDescription}
                            onChange={(e) => setNewScenarioDescription(e.target.value)}
                            placeholder="Enter description"
                          />
                        </div>
                      </div>

                      <div className="border rounded-md p-4">
                        <h4 className="text-sm font-medium mb-2">Add Step</h4>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <Label>Select Pins</Label>
                            <div className="border rounded-md p-2 h-24 overflow-auto">
                              <div className="grid grid-cols-3 gap-2">
                                {pins.map((pin) => (
                                  <div key={pin.id} className="flex items-center space-x-2">
                                    <Checkbox
                                      id={`step-pin-${pin.id}`}
                                      checked={newStepPinIds.includes(pin.id)}
                                      onCheckedChange={(checked) => {
                                        if (checked) {
                                          setNewStepPinIds((prev) => [...prev, pin.id])
                                        } else {
                                          setNewStepPinIds((prev) => prev.filter((id) => id !== pin.id))
                                        }
                                      }}
                                    />
                                    <Label htmlFor={`step-pin-${pin.id}`}>{pin.name}</Label>
                                  </div>
                                ))}
                              </div>
                            </div>
                          </div>
                          <div className="space-y-4">
                            <div className="space-y-2">
                              <Label htmlFor="step-action">Action</Label>
                              <Select value={newStepAction} onValueChange={(value) => setNewStepAction(value as any)}>
                                <SelectTrigger id="step-action">
                                  <SelectValue placeholder="Select action" />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="on">Turn On</SelectItem>
                                  <SelectItem value="off">Turn Off</SelectItem>
                                  <SelectItem value="toggle">Toggle</SelectItem>
                                  <SelectItem value="pwm">Set PWM</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>

                            {newStepAction === "pwm" && (
                              <div className="space-y-2">
                                <Label htmlFor="step-pwm-value">PWM Value: {newStepValue}%</Label>
                                <Slider
                                  id="step-pwm-value"
                                  min={0}
                                  max={100}
                                  step={1}
                                  value={[newStepValue]}
                                  onValueChange={(value) => setNewStepValue(value[0])}
                                />
                              </div>
                            )}

                            <div className="space-y-2">
                              <Label htmlFor="step-delay">Delay (ms)</Label>
                              <Input
                                id="step-delay"
                                type="number"
                                min={0}
                                value={newStepDelay}
                                onChange={(e) => setNewStepDelay(Number(e.target.value))}
                              />
                            </div>

                            <Button onClick={addScenarioStep} className="w-full">
                              Add Step
                            </Button>
                          </div>
                        </div>
                      </div>

                      <div className="space-y-2">
                        <Label>Scenario Steps</Label>
                        {newScenarioSteps.length === 0 ? (
                          <div className="text-center py-4 border rounded-md bg-muted/20">
                            <p className="text-sm text-muted-foreground">No steps added yet</p>
                          </div>
                        ) : (
                          <div className="border rounded-md overflow-hidden">
                            <table className="w-full">
                              <thead className="bg-muted/50">
                                <tr>
                                  <th className="text-left p-2 text-xs font-medium">Step</th>
                                  <th className="text-left p-2 text-xs font-medium">Pins</th>
                                  <th className="text-left p-2 text-xs font-medium">Action</th>
                                  <th className="text-left p-2 text-xs font-medium">Delay</th>
                                  <th className="text-right p-2 text-xs font-medium">Remove</th>
                                </tr>
                              </thead>
                              <tbody>
                                {newScenarioSteps.map((step, index) => (
                                  <tr key={step.id} className="border-t">
                                    <td className="p-2 text-sm">{index + 1}</td>
                                    <td className="p-2 text-sm">
                                      {step.pinIds.length} pins
                                      <Popover>
                                        <PopoverTrigger asChild>
                                          <Button variant="ghost" size="sm" className="h-6 ml-1">
                                            <ChevronDown className="h-3 w-3" />
                                          </Button>
                                        </PopoverTrigger>
                                        <PopoverContent className="w-60">
                                          <div className="text-xs">
                                            {step.pinIds.map((pinId) => {
                                              const pin = pins.find((p) => p.id === pinId)
                                              return pin ? (
                                                <Badge key={pinId} variant="outline" className="m-1">
                                                  {pin.name}
                                                </Badge>
                                              ) : null
                                            })}
                                          </div>
                                        </PopoverContent>
                                      </Popover>
                                    </td>
                                    <td className="p-2 text-sm">
                                      {step.action === "on"
                                        ? "Turn On"
                                        : step.action === "off"
                                          ? "Turn Off"
                                          : step.action === "toggle"
                                            ? "Toggle"
                                            : `PWM ${step.value}%`}
                                    </td>
                                    <td className="p-2 text-sm">{step.delay}ms</td>
                                    <td className="p-2 text-right">
                                      <Button
                                        variant="ghost"
                                        size="icon"
                                        className="h-6 w-6"
                                        onClick={() => removeScenarioStep(step.id)}
                                      >
                                        <X className="h-3 w-3" />
                                      </Button>
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        )}
                      </div>
                    </div>
                    <DialogFooter>
                      <Button onClick={saveScenario} disabled={newScenarioSteps.length === 0}>
                        Save Scenario
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              </div>

              {scenarios.length === 0 ? (
                <div className="text-center py-12 border rounded-lg bg-muted/20">
                  <PlayCircle className="h-12 w-12 mx-auto text-muted-foreground" />
                  <h3 className="mt-4 text-lg font-medium">No Scenarios Created</h3>
                  <p className="mt-2 text-sm text-muted-foreground">
                    Create a scenario to automate sequences of pin operations.
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {scenarios.map((scenario) => (
                    <Card key={scenario.id}>
                      <CardHeader>
                        <CardTitle className="flex justify-between items-center">
                          <span>{scenario.name}</span>
                          <Button variant="ghost" size="icon" onClick={() => deleteScenario(scenario.id)}>
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </CardTitle>
                        <CardDescription>{scenario.description || "No description"}</CardDescription>
                      </CardHeader>
                      <CardContent>
                        <div className="flex items-center gap-2 mb-2">
                          <Badge variant="outline">{scenario.steps.length} steps</Badge>
                          <Badge variant="outline">
                            {scenario.steps.reduce((total, step) => total + step.delay, 0)}ms total
                          </Badge>
                        </div>
                        <Accordion type="single" collapsible className="w-full">
                          <AccordionItem value="steps">
                            <AccordionTrigger className="text-sm">View Steps</AccordionTrigger>
                            <AccordionContent>
                              <div className="text-xs space-y-1">
                                {scenario.steps.map((step, index) => (
                                  <div key={step.id} className="flex justify-between items-center p-1 border-b">
                                    <span>
                                      {index + 1}. {step.action.toUpperCase()}
                                      {step.action === "pwm" && step.value !== undefined && ` (${step.value}%)`}
                                    </span>
                                    <span className="text-muted-foreground">{step.delay}ms</span>
                                  </div>
                                ))}
                              </div>
                            </AccordionContent>
                          </AccordionItem>
                        </Accordion>
                      </CardContent>
                      <CardFooter>
                        <Button
                          onClick={() => runScenario(scenario)}
                          className="w-full"
                          variant={isRunningScenario && activeScenario?.id === scenario.id ? "destructive" : "default"}
                        >
                          {isRunningScenario && activeScenario?.id === scenario.id ? (
                            <>Stop Scenario</>
                          ) : (
                            <>
                              <Play className="h-4 w-4 mr-2" />
                              Run Scenario
                            </>
                          )}
                        </Button>
                      </CardFooter>
                    </Card>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* History Tab */}
          {activeTab === "history" && (
            <div className="space-y-6">
              <div className="flex justify-between items-center">
                <h3 className="text-xl font-bold">Pin History</h3>
                <div className="flex items-center gap-2">
                  <div className="flex items-center space-x-2">
                    <Switch id="history-enabled" checked={historyEnabled} onCheckedChange={setHistoryEnabled} />
                    <Label htmlFor="history-enabled">Record History</Label>
                  </div>
                  <Button variant="outline" size="sm" onClick={clearHistory}>
                    Clear
                  </Button>
                  <Button variant="outline" size="sm" onClick={exportHistory}>
                    <Download className="h-4 w-4 mr-1" />
                    Export
                  </Button>
                </div>
              </div>

              {pinHistory.length === 0 ? (
                <div className="text-center py-12 border rounded-lg bg-muted/20">
                  <History className="h-12 w-12 mx-auto text-muted-foreground" />
                  <h3 className="mt-4 text-lg font-medium">No History Recorded</h3>
                  <p className="mt-2 text-sm text-muted-foreground">
                    Pin state changes will be recorded here when they occur.
                  </p>
                </div>
              ) : (
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle>Pin State Changes</CardTitle>
                    <CardDescription>Recent history of pin state changes</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <ScrollArea className="h-[400px] rounded border p-2">
                      <div className="space-y-2">
                        {pinHistory.map((entry, index) => {
                          const pin = pins.find((p) => p.id === entry.pinId)
                          if (!pin) return null

                          return (
                            <div
                              key={index}
                              className={`text-xs p-2 rounded flex items-center justify-between ${
                                entry.state
                                  ? "bg-green-50 text-green-800 dark:bg-green-950/30 dark:text-green-300"
                                  : "bg-gray-50 text-gray-800 dark:bg-gray-900 dark:text-gray-300"
                              }`}
                            >
                              <div>
                                <div className="font-mono text-[10px] text-muted-foreground">
                                  {entry.timestamp.toLocaleTimeString()}
                                </div>
                                <div className="font-medium">{pin.name}</div>
                              </div>
                              <div className="flex items-center gap-2">
                                <Badge variant={entry.state ? "default" : "outline"}>
                                  {entry.state ? "HIGH" : "LOW"}
                                </Badge>
                                {pin.mode === "pwm" && entry.state && (
                                  <Badge variant="secondary">{pin.pwmValue}%</Badge>
                                )}
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    </ScrollArea>
                  </CardContent>
                </Card>
              )}
            </div>
          )}

          {/* API Tab */}
          {activeTab === "api" && (
            <div className="space-y-6">
              <div className="flex justify-between items-center">
                <h3 className="text-xl font-bold">API Connection</h3>
                <Badge variant={isConnected ? "default" : "destructive"} className="ml-2">
                  {isConnected ? "Connected" : "Disconnected"}
                </Badge>
              </div>

              <Card>
                <CardHeader>
                  <CardTitle>Connection Settings</CardTitle>
                  <CardDescription>Connect to a backend API or WebSocket</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="connection-type">Connection Type</Label>
                    <RadioGroup
                      value={connectionType}
                      onValueChange={(value) => setConnectionType(value as "websocket" | "rest")}
                      className="flex space-x-4"
                    >
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="rest" id="rest" />
                        <Label htmlFor="rest">REST API</Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="websocket" id="websocket" />
                        <Label htmlFor="websocket">WebSocket</Label>
                      </div>
                    </RadioGroup>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="backend-url">Backend URL</Label>
                    <div className="flex gap-2">
                      <Input
                        id="backend-url"
                        placeholder={connectionType === "websocket" ? "ws://localhost:8080" : "http://localhost:3000"}
                        value={backendUrl}
                        onChange={(e) => setBackendUrl(e.target.value)}
                      />
                      <Button
                        variant={isConnected ? "destructive" : "default"}
                        onClick={toggleConnection}
                        className="whitespace-nowrap"
                      >
                        {isConnected ? (
                          <>
                            <WifiOff className="h-4 w-4 mr-2" /> Disconnect
                          </>
                        ) : (
                          <>
                            <Wifi className="h-4 w-4 mr-2" /> Connect
                          </>
                        )}
                      </Button>
                    </div>
                  </div>

                  {connectionType === "rest" && (
                    <div className="space-y-4">
                      <div className="space-y-2">
                        <Label htmlFor="api-endpoint">API Endpoint</Label>
                        <Input
                          id="api-endpoint"
                          placeholder="/api/gpio"
                          value={apiEndpoint}
                          onChange={(e) => setApiEndpoint(e.target.value)}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="api-method">HTTP Method</Label>
                        <Select value={apiMethod} onValueChange={setApiMethod}>
                          <SelectTrigger id="api-method">
                            <SelectValue placeholder="Select method" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="GET">GET</SelectItem>
                            <SelectItem value="POST">POST</SelectItem>
                            <SelectItem value="PUT">PUT</SelectItem>
                            <SelectItem value="PATCH">PATCH</SelectItem>
                            <SelectItem value="DELETE">DELETE</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  )}

                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label htmlFor="api-payload">Payload</Label>
                      <div className="flex items-center space-x-2">
                        <Checkbox
                          id="batch-mode"
                          checked={batchMode}
                          onCheckedChange={(checked) => setBatchMode(checked as boolean)}
                        />
                        <Label htmlFor="batch-mode">Batch Mode</Label>
                      </div>
                    </div>
                    <Textarea
                      id="api-payload"
                      placeholder="Enter JSON payload or leave empty to use current pin state"
                      value={apiPayload}
                      onChange={(e) => setApiPayload(e.target.value)}
                      className="font-mono text-xs h-24"
                    />
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center space-x-2">
                      <Checkbox
                        id="api-auth"
                        checked={apiAuthEnabled}
                        onCheckedChange={(checked) => setApiAuthEnabled(checked as boolean)}
                      />
                      <Label htmlFor="api-auth">Authentication</Label>
                    </div>
                    {apiAuthEnabled && (
                      <Input
                        id="api-token"
                        type="password"
                        placeholder="Bearer token"
                        value={apiAuthToken}
                        onChange={(e) => setApiAuthToken(e.target.value)}
                      />
                    )}
                  </div>

                  <Button onClick={sendApiRequest} disabled={!isConnected} className="w-full">
                    <Send className="h-4 w-4 mr-2" />
                    Send Request
                  </Button>

                  <div className="space-y-2">
                    <Label htmlFor="api-response">Response</Label>
                    <ScrollArea className="h-24 rounded border p-2">
                      <pre className="font-mono text-xs whitespace-pre-wrap">{apiResponse || "No response yet"}</pre>
                    </ScrollArea>
                  </div>

                  <div className="space-y-2">
                    <Label>Request History</Label>
                    <ScrollArea className="h-24 rounded border p-2">
                      {apiRequests.length === 0 ? (
                        <div className="text-center py-2 text-muted-foreground">No requests yet</div>
                      ) : (
                        <div className="space-y-2">
                          {apiRequests.map((req, index) => (
                            <div key={index} className="text-xs p-2 rounded bg-gray-50 dark:bg-gray-900">
                              <div className="flex justify-between">
                                <span className="font-mono text-[10px] text-muted-foreground">
                                  {req.timestamp.toLocaleTimeString()}
                                </span>
                                <Badge variant="outline" className="text-[10px]">
                                  {req.status}
                                </Badge>
                              </div>
                              <div className="font-medium">
                                {req.method} {req.endpoint}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </ScrollArea>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          {/* Logs Tab */}
          {activeTab === "logs" && (
            <div className="space-y-6">
              <div className="flex justify-between items-center">
                <h3 className="text-xl font-bold">Activity Log</h3>
                <div className="flex items-center gap-2">
                  <div className="flex items-center space-x-2">
                    <Switch id="logging" checked={loggingEnabled} onCheckedChange={setLoggingEnabled} />
                    <Label htmlFor="logging">Logging</Label>
                  </div>
                  <Button variant="outline" size="sm" onClick={clearLogs}>
                    Clear
                  </Button>
                  <Button variant="outline" size="sm" onClick={exportLogs}>
                    <Download className="h-4 w-4 mr-1" />
                    Export
                  </Button>
                </div>
              </div>

              <Card>
                <CardContent className="p-4">
                  <ScrollArea className="h-[500px] rounded border p-2">
                    {logs.length === 0 ? (
                      <div className="text-center py-8 text-muted-foreground">No logs to display</div>
                    ) : (
                      <div className="space-y-2">
                        {logs.map((log, index) => (
                          <div
                            key={index}
                            className={`text-xs p-2 rounded ${
                              log.type === "error"
                                ? "bg-red-50 text-red-800 dark:bg-red-950/30 dark:text-red-300"
                                : log.type === "warning"
                                  ? "bg-yellow-50 text-yellow-800 dark:bg-yellow-950/30 dark:text-yellow-300"
                                  : "bg-gray-50 dark:bg-gray-900"
                            }`}
                          >
                            <div className="font-mono text-[10px] text-muted-foreground">
                              {log.timestamp.toLocaleTimeString()}
                            </div>
                            <div>{log.message}</div>
                          </div>
                        ))}
                      </div>
                    )}
                  </ScrollArea>
                </CardContent>
              </Card>
            </div>
          )}

          {/* Settings Tab */}
          {activeTab === "settings" && (
            <div className="space-y-6">
              <div className="flex justify-between items-center">
                <h3 className="text-xl font-bold">Simulator Settings</h3>
                <div className="flex items-center gap-2">
                  <Button variant="outline" onClick={saveConfiguration}>
                    <Save className="h-4 w-4 mr-1" />
                    Export Config
                  </Button>
                  <div className="relative">
                    <Input
                      type="file"
                      id="import-config"
                      className="absolute inset-0 opacity-0 cursor-pointer"
                      accept=".json"
                      onChange={importConfiguration}
                    />
                    <Button variant="outline">
                      <Upload className="h-4 w-4 mr-1" />
                      Import Config
                    </Button>
                  </div>
                </div>
              </div>

              <Card>
                <CardHeader>
                  <CardTitle>General Settings</CardTitle>
                  <CardDescription>Configure the GPIO simulator</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="pin-count">Number of Pins</Label>
                    <div className="flex items-center space-x-2">
                      <Select
                        value={pinCount.toString()}
                        onValueChange={(value) => setPinCount(Number.parseInt(value))}
                      >
                        <SelectTrigger id="pin-count">
                          <SelectValue placeholder="Select pin count" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="8">8 pins</SelectItem>
                          <SelectItem value="16">16 pins</SelectItem>
                          <SelectItem value="24">24 pins</SelectItem>
                          <SelectItem value="32">32 pins</SelectItem>
                          <SelectItem value="40">40 pins</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label>Simulation Options</Label>
                    <div className="grid grid-cols-1 gap-2">
                      <div className="flex items-center space-x-2">
                        <Checkbox
                          id="auto-refresh-setting"
                          checked={autoRefresh}
                          onCheckedChange={(checked) => setAutoRefresh(checked as boolean)}
                        />
                        <Label htmlFor="auto-refresh-setting">Auto-refresh pin states</Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Checkbox
                          id="logging-setting"
                          checked={loggingEnabled}
                          onCheckedChange={(checked) => setLoggingEnabled(checked as boolean)}
                        />
                        <Label htmlFor="logging-setting">Enable logging</Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Checkbox
                          id="history-setting"
                          checked={historyEnabled}
                          onCheckedChange={(checked) => setHistoryEnabled(checked as boolean)}
                        />
                        <Label htmlFor="history-setting">Record pin history</Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Checkbox
                          id="batch-mode-setting"
                          checked={batchMode}
                          onCheckedChange={(checked) => setBatchMode(checked as boolean)}
                        />
                        <Label htmlFor="batch-mode-setting">Batch mode (select multiple pins)</Label>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label>Theme</Label>
                    <div className="grid grid-cols-1 gap-2">
                      <div className="flex items-center space-x-2">
                        <RadioGroup value={theme || "system"} onValueChange={setTheme} className="flex space-x-4">
                          <div className="flex items-center space-x-2">
                            <RadioGroupItem value="light" id="theme-light" />
                            <Label htmlFor="theme-light">Light</Label>
                          </div>
                          <div className="flex items-center space-x-2">
                            <RadioGroupItem value="dark" id="theme-dark" />
                            <Label htmlFor="theme-dark">Dark</Label>
                          </div>
                          <div className="flex items-center space-x-2">
                            <RadioGroupItem value="system" id="theme-system" />
                            <Label htmlFor="theme-system">System</Label>
                          </div>
                        </RadioGroup>
                      </div>
                    </div>
                  </div>
                </CardContent>
                <CardFooter className="flex justify-between">
                  <Button variant="outline" onClick={refreshPinStates}>
                    <RefreshCw className="h-4 w-4 mr-1" />
                    Refresh All
                  </Button>
                  <Button
                    onClick={() => {
                      // Reset all settings to default
                      setAutoRefresh(false)
                      setLoggingEnabled(true)
                      setHistoryEnabled(true)
                      setBatchMode(false)
                      setPinCount(16)
                      addLog("Settings reset to defaults", "info")
                    }}
                  >
                    Reset Defaults
                  </Button>
                </CardFooter>
              </Card>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
