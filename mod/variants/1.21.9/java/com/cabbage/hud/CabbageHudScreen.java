package com.cabbage.hud;

import net.minecraft.client.MinecraftClient;
import net.minecraft.client.gui.Click;
import net.minecraft.client.gui.DrawContext;
import net.minecraft.client.gui.screen.Screen;
import net.minecraft.client.gui.widget.ButtonWidget;
import net.minecraft.client.gui.widget.ClickableWidget;
import net.minecraft.text.Text;

import java.util.LinkedHashMap;
import java.util.Map;

/**
 * In-game HUD editor (open with Right Shift). The menu panel itself is
 * draggable by its header band (position persists); each toggle button lives at
 * a fixed offset inside it. HUD elements are drawn live and can be dragged to
 * reposition. Buttons get the Cabbage skin via PressableWidgetMixin.
 */
public class CabbageHudScreen extends Screen {

    private static final int COL_W = 122;
    private static final int ROW_H = 24;
    private static final int PANEL_W = 12 + COL_W * 2 + 16;
    private static final int HEADER_H = 26;

    private CabbageElements.HudElement dragging;
    private int dragOffX;
    private int dragOffY;

    private int panelX;
    private int panelY;
    private int panelH;
    private boolean draggingPanel;
    private int panelDragOffX;
    private int panelDragOffY;

    /** Each widget's offset relative to the panel origin, so the panel can move. */
    private final Map<ClickableWidget, int[]> widgetOffsets = new LinkedHashMap<>();

    public CabbageHudScreen() {
        super(Text.literal("Cabbage HUD Editor"));
    }

    @Override
    protected void init() {
        widgetOffsets.clear();
        CabbageConfig cfg = CabbageConfig.get();
        var els = CabbageHudClient.ELEMENTS;

        int rows = (els.size() + 1) / 2;
        // element rows + 2 ESP rows (toggles + block picker) + footer row
        panelH = 30 + rows * ROW_H + 2 * ROW_H + 6 + 20 + 8;
        panelX = clampX(cfg.panelX);
        panelY = clampY(cfg.panelY);

        for (int i = 0; i < els.size(); i++) {
            CabbageElements.HudElement el = els.get(i);
            CabbageConfig.Elem st = cfg.elem(el.id, el.defX, el.defY);
            int dx = 8 + (i % 2) * (COL_W + 8);
            int dy = 30 + (i / 2) * ROW_H;
            ButtonWidget b = ButtonWidget.builder(label(el.label, st.enabled), btn -> {
                st.enabled = !st.enabled;
                btn.setMessage(label(el.label, st.enabled));
                cfg.save();
            }).dimensions(panelX + dx, panelY + dy, COL_W, 20).build();
            addDrawableChild(b);
            widgetOffsets.put(b, new int[]{dx, dy});
        }

        // ESP toggles (their own row, red when on to flag they're cheat-tier)
        int espDy = 30 + rows * ROW_H;
        ButtonWidget playerEsp = ButtonWidget.builder(espLabel("Player ESP", cfg.playerEsp), b -> {
            cfg.playerEsp = !cfg.playerEsp;
            b.setMessage(espLabel("Player ESP", cfg.playerEsp));
            cfg.save();
        }).dimensions(panelX + 8, panelY + espDy, COL_W, 20).build();
        addDrawableChild(playerEsp);
        widgetOffsets.put(playerEsp, new int[]{8, espDy});

        ButtonWidget blockEsp = ButtonWidget.builder(espLabel("Block ESP", cfg.blockEsp), b -> {
            cfg.blockEsp = !cfg.blockEsp;
            b.setMessage(espLabel("Block ESP", cfg.blockEsp));
            cfg.save();
            CabbageEsp.requestRescan();
        }).dimensions(panelX + 8 + COL_W + 8, panelY + espDy, COL_W, 20).build();
        addDrawableChild(blockEsp);
        widgetOffsets.put(blockEsp, new int[]{8 + COL_W + 8, espDy});

        // block-ESP ore picker (full width)
        int pickDy = espDy + ROW_H;
        ButtonWidget pick = ButtonWidget.builder(Text.literal("Select ESP blocks…"),
                b -> this.client.setScreen(new CabbageBlockEspScreen(this)))
                .dimensions(panelX + 8, panelY + pickDy, COL_W * 2 + 8, 20).build();
        addDrawableChild(pick);
        widgetOffsets.put(pick, new int[]{8, pickDy});

        int footDy = 30 + rows * ROW_H + 2 * ROW_H + 6;
        ButtonWidget reset = ButtonWidget.builder(Text.literal("Reset positions"), b -> {
            for (CabbageElements.HudElement el : els) {
                CabbageConfig.Elem st = cfg.elem(el.id, el.defX, el.defY);
                st.x = el.defX;
                st.y = el.defY;
            }
            cfg.save();
        }).dimensions(panelX + 8, panelY + footDy, COL_W, 20).build();
        addDrawableChild(reset);
        widgetOffsets.put(reset, new int[]{8, footDy});

        ButtonWidget done = ButtonWidget.builder(Text.literal("Done"), b -> close())
                .dimensions(panelX + 8 + COL_W + 8, panelY + footDy, COL_W, 20).build();
        addDrawableChild(done);
        widgetOffsets.put(done, new int[]{8 + COL_W + 8, footDy});
    }

    private Text label(String name, boolean on) {
        return Text.literal((on ? "§a✔ §f" : "§8✘ §7") + name);
    }

    private Text espLabel(String name, boolean on) {
        return Text.literal((on ? "§c● §f" : "§8○ §7") + name);
    }

    private int clampX(int x) {
        return Math.max(0, Math.min(this.width - PANEL_W, x));
    }

    private int clampY(int y) {
        return Math.max(0, Math.min(this.height - panelH, y));
    }

    private void movePanel(int nx, int ny) {
        panelX = clampX(nx);
        panelY = clampY(ny);
        for (Map.Entry<ClickableWidget, int[]> e : widgetOffsets.entrySet()) {
            e.getKey().setX(panelX + e.getValue()[0]);
            e.getKey().setY(panelY + e.getValue()[1]);
        }
    }

    @Override
    public void render(DrawContext ctx, int mouseX, int mouseY, float delta) {
        MinecraftClient mc = this.client;

        // menu panel + header (under the buttons, over the background dim)
        CabbageSkin.panel(ctx, panelX, panelY, PANEL_W, panelH);
        if (mc != null) {
            CabbageSkin.drawBird(ctx, panelX + 8, panelY + 6, 14);
            ctx.drawTextWithShadow(mc.textRenderer, "CABBAGE HUD", panelX + 27, panelY + 9, CabbageSkin.LIME);
            ctx.drawTextWithShadow(mc.textRenderer, "EDITOR",
                    panelX + 27 + mc.textRenderer.getWidth("CABBAGE HUD "), panelY + 9, CabbageSkin.TEXT_DIM);
            String grip = "⣿";
            ctx.drawTextWithShadow(mc.textRenderer, grip,
                    panelX + PANEL_W - 6 - mc.textRenderer.getWidth(grip), panelY + 9,
                    draggingPanel ? CabbageSkin.LIME : CabbageSkin.TEXT_DIM);
            ctx.drawTextWithShadow(mc.textRenderer,
                    "§7Drag elements to move · drag the header to move this menu · Esc closes",
                    8, this.height - 14, CabbageSkin.TEXT);
        }

        super.render(ctx, mouseX, mouseY, delta);

        if (mc == null || mc.player == null) {
            return;
        }

        // live element preview + drag handles
        CabbageConfig cfg = CabbageConfig.get();
        for (CabbageElements.HudElement el : CabbageHudClient.ELEMENTS) {
            CabbageConfig.Elem st = cfg.elem(el.id, el.defX, el.defY);
            if (!st.enabled) {
                continue;
            }
            int w = el.width(mc, mc.textRenderer);
            int h = el.height(mc, mc.textRenderer);
            boolean hover = mouseX >= st.x && mouseX <= st.x + w && mouseY >= st.y && mouseY <= st.y + h;
            ctx.fill(st.x - 2, st.y - 2, st.x + w + 2, st.y + h + 2, hover ? 0x40B6F04A : 0x20FFFFFF);
            if (hover || dragging == el) {
                CabbageSkin.border(ctx, st.x - 2, st.y - 2, w + 4, h + 4, CabbageSkin.LIME);
            }
            el.render(ctx, mc.textRenderer, mc, st.x, st.y);
        }
    }

    @Override
    public boolean mouseClicked(Click click, boolean doubled) {
        // Priority: HUD elements (drawn topmost) → panel header (menu drag) →
        // the buttons. Element-first also means an element parked over a button
        // can always be dragged away again.
        double mouseX = click.x();
        double mouseY = click.y();
        MinecraftClient mc = this.client;
        if (mc != null && mc.player != null && click.button() == 0) {
            CabbageConfig cfg = CabbageConfig.get();
            // iterate in reverse so the topmost element wins overlaps
            var els = CabbageHudClient.ELEMENTS;
            for (int i = els.size() - 1; i >= 0; i--) {
                CabbageElements.HudElement el = els.get(i);
                CabbageConfig.Elem st = cfg.elem(el.id, el.defX, el.defY);
                if (!st.enabled) {
                    continue;
                }
                int w = el.width(mc, mc.textRenderer);
                int h = el.height(mc, mc.textRenderer);
                if (mouseX >= st.x && mouseX <= st.x + w && mouseY >= st.y && mouseY <= st.y + h) {
                    dragging = el;
                    dragOffX = (int) mouseX - st.x;
                    dragOffY = (int) mouseY - st.y;
                    return true;
                }
            }

            if (mouseX >= panelX && mouseX <= panelX + PANEL_W
                    && mouseY >= panelY && mouseY <= panelY + HEADER_H) {
                draggingPanel = true;
                panelDragOffX = (int) mouseX - panelX;
                panelDragOffY = (int) mouseY - panelY;
                return true;
            }
        }
        return super.mouseClicked(click, doubled);
    }

    @Override
    public boolean mouseDragged(Click click, double offsetX, double offsetY) {
        if (draggingPanel) {
            movePanel((int) click.x() - panelDragOffX, (int) click.y() - panelDragOffY);
            return true;
        }
        if (dragging != null) {
            CabbageConfig.Elem st = CabbageConfig.get().elem(dragging.id, dragging.defX, dragging.defY);
            st.x = Math.max(0, Math.min(this.width - 4, (int) click.x() - dragOffX));
            st.y = Math.max(0, Math.min(this.height - 4, (int) click.y() - dragOffY));
            return true;
        }
        return super.mouseDragged(click, offsetX, offsetY);
    }

    @Override
    public boolean mouseReleased(Click click) {
        if (draggingPanel) {
            draggingPanel = false;
            CabbageConfig cfg = CabbageConfig.get();
            cfg.panelX = panelX;
            cfg.panelY = panelY;
            cfg.save();
            return true;
        }
        if (dragging != null) {
            dragging = null;
            CabbageConfig.get().save();
            return true;
        }
        return super.mouseReleased(click);
    }

    @Override
    public boolean shouldPause() {
        return false;
    }
}
