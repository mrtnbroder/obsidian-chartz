import {
  MarkdownView,
  Plugin,
  parseYaml,
  Menu,
  Editor,
  Notice,
  type MarkdownPostProcessorContext,
  type MarkdownFileInfo,
} from "obsidian"

import Renderer from "./chartRenderer.js"
import {
  type ChartPluginSettings,
  DEFAULT_SETTINGS,
} from "./constants/settingsConstants.js"
import { ChartSettingTab } from "./ui/settingsTab.js"
import { CreationHelperModal } from "./ui/creationHelperModal.js"
import { addIcons } from "./ui/icons.js"
import { chartFromTable } from "./chartFromTable.js"
import { renderError, saveImageToVaultAndPaste } from "./util.js"

export default class ChartPlugin extends Plugin {
  public settings!: ChartPluginSettings
  public renderer!: Renderer

  postprocessor = async (
    content: string,
    el: HTMLElement,
    ctx: MarkdownPostProcessorContext,
  ) => {
    let data
    try {
      data = await parseYaml(content.replace(/	/g, "    "))
    } catch (error) {
      renderError(error, el)
      return
    }
    if (!data.id) {
      if (!data || !data.type || !data.labels || !data.series) {
        renderError("Missing type, labels or series", el)
        return
      }
    }
    if (data.bestFit === true && data.type === "line") {
      if (data.bestFitNumber != undefined) {
        var x = data.series[Number(data.bestFitNumber)].data
      } else {
        // Default to line 0
        var x = data.series[0].data
      }

      let y = data.labels
      let outX = 0
      let outY = 0
      let outX2 = 0
      let outXY = 0

      for (let i = 0; i < x.length; ++i) {
        outX = outX + x[i]
        outY = outY + y[i]
        outX2 = outX2 + x[i] * x[i]
        outXY = outXY + x[i] * y[i]
      }
      let gradient =
        (x.length * outXY - outY * outX) / (x.length * outX2 - outX * outX)
      let intercept = (outY - gradient * outX) / x.length

      // Form points from equation
      let YVals = []
      for (let i = 0; i < y.length; ++i) {
        YVals.push((y[i] - intercept) / gradient)
      }

      if (data.bestFitTitle != undefined && data.bestFitTitle != "undefined") {
        var title = String(data.bestFitTitle)
      } else {
        var title = "Line of Best Fit"
      }
      // Create line
      data.series.push({
        title: title,
        data: YVals,
      })
    }
    await this.renderer.renderFromYaml(data, el, ctx)
  }

  async loadSettings() {
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData())
  }

  async saveSettings() {
    await this.saveData(this.settings)
  }

  override async onload() {
    console.log("loading plugin: Obsidian Chartz")

    await this.loadSettings()

    addIcons()

    this.renderer = new Renderer(this)

    //@ts-ignore
    window.renderChart = this.renderer.renderRaw

    this.addSettingTab(new ChartSettingTab(this.app, this))

    this.addCommand({
      id: "creation-helper",
      name: "Insert new Chart",
      checkCallback: (checking: boolean) => {
        let leaf = this.app.workspace.activeLeaf

        if (leaf?.view instanceof MarkdownView) {
          if (!checking) {
            new CreationHelperModal(
              this.app,
              leaf.view,
              this.settings,
              this.renderer,
            ).open()
          }
          return true
        }
        return false
      },
    })

    this.addCommand({
      id: "chart-from-table-column",
      name: "Create Chart from Table (Column oriented Layout)",
      editorCheckCallback: (
        checking: boolean,
        editor: Editor,
        ctx: MarkdownView | MarkdownFileInfo,
      ) => {
        let selection = editor.getSelection()
        if (
          ctx instanceof MarkdownView &&
          selection.split("\n").length >= 3 &&
          selection.split("|").length >= 2
        ) {
          if (!checking) {
            chartFromTable(editor, "columns")
          }
          return true
        }
        return false
      },
    })

    this.addCommand({
      id: "chart-from-table-row",
      name: "Create Chart from Table (Row oriented Layout)",
      editorCheckCallback: (
        checking: boolean,
        editor: Editor,
        ctx: MarkdownView | MarkdownFileInfo,
      ) => {
        if (
          ctx instanceof MarkdownView &&
          editor.getSelection().split("\n").length >= 3 &&
          editor.getSelection().split("|").length >= 2
        ) {
          if (!checking) {
            chartFromTable(editor, "rows")
          }
          return true
        }
        return false
      },
    })

    this.addCommand({
      id: "chart-to-svg",
      name: "Create Image from Chart",
      editorCheckCallback: (
        checking: boolean,
        editor: Editor,
        ctx: MarkdownView | MarkdownFileInfo,
      ) => {
        if (
          ctx instanceof MarkdownView &&
          editor.getSelection().startsWith("```chart") &&
          editor.getSelection().endsWith("```")
        ) {
          if (!checking && ctx.file) {
            new Notice("Rendering Chart...")
            saveImageToVaultAndPaste(
              editor,
              this.app,
              this.renderer,
              ctx.file,
              this.settings,
            )
          }
          return true
        }
        return false
      },
    })

    this.registerMarkdownCodeBlockProcessor("chart", this.postprocessor)
    this.registerMarkdownCodeBlockProcessor(
      "advanced-chart",
      async (data, el) => {
        console.log("data", data)
        return this.renderer.renderRaw(await JSON.parse(data), el)
      },
    )

    this.registerEvent(
      this.app.workspace.on(
        "editor-menu",
        (menu: Menu, _: Editor, view: MarkdownView) => {
          if (view && this.settings.contextMenu) {
            menu.addItem((item) => {
              item
                .setTitle("Insert Chart")
                .setIcon("chart")
                .onClick((_) => {
                  new CreationHelperModal(
                    this.app,
                    view,
                    this.settings,
                    this.renderer,
                  ).open()
                })
            })
          }
        },
      ),
    )
  }

  override onunload() {
    console.log("unloading plugin: Obsidian Chartz")
  }
}
