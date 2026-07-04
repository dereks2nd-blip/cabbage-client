package com.cabbage.hud;

import net.minecraft.client.gui.DrawContext;
import net.minecraft.client.gui.screen.Screen;
import net.minecraft.client.gui.widget.ButtonWidget;
import net.minecraft.text.Text;

import java.util.ArrayList;
import java.util.List;

/**
 * Block-ESP block picker: one toggle per block group with a live color swatch,
 * laid out in two columns. Opened from the HUD editor; returns to it on close.
 */
public class CabbageBlockEspScreen extends Screen {

    private static final int COL_W = 150;
    private static final int COL_GAP = 34;
    private static final int LEFT_PAD = 30;
    private static final int PANEL_W = LEFT_PAD + COL_W + COL_GAP + COL_W + 16;
    private static final int ROW_H = 24;

    private final Screen parent;
    private final List<Entry> entries = new ArrayList<>();
    private int panelX;
    private int panelY;
    private int panelH;

    private record Entry(CabbageEsp.Ore ore, ButtonWidget button) {
    }

    public CabbageBlockEspScreen(Screen parent) {
        super(Text.literal("Block ESP — Blocks"));
        this.parent = parent;
    }

    @Override
    protected void init() {
        entries.clear();
        CabbageConfig cfg = CabbageConfig.get();
        int count = CabbageEsp.ORE_TYPES.size();
        int rows = (count + 1) / 2;
        panelH = 34 + rows * ROW_H + 30;
        panelX = (this.width - PANEL_W) / 2;
        panelY = Math.max(10, (this.height - panelH) / 2);

        for (int i = 0; i < count; i++) {
            CabbageEsp.Ore ore = CabbageEsp.ORE_TYPES.get(i);
            boolean on = cfg.espBlockEnabled(ore.key, ore.defaultOn);
            int col = i % 2;
            int row = i / 2;
            int x = panelX + LEFT_PAD + col * (COL_W + COL_GAP);
            int y = panelY + 34 + row * ROW_H;
            ButtonWidget b = ButtonWidget.builder(oreLabel(ore.name, on), btn -> {
                boolean now = !cfg.espBlockEnabled(ore.key, ore.defaultOn);
                cfg.setEspBlock(ore.key, now);
                btn.setMessage(oreLabel(ore.name, now));
                cfg.save();
                CabbageEsp.requestRescan();
            }).dimensions(x, y, COL_W, 20).build();
            addDrawableChild(b);
            entries.add(new Entry(ore, b));
        }

        addDrawableChild(ButtonWidget.builder(Text.literal("Done"), btn -> close())
                .dimensions(panelX + LEFT_PAD, panelY + panelH - 26, PANEL_W - LEFT_PAD - 16, 20).build());
    }

    private Text oreLabel(String name, boolean on) {
        return Text.literal((on ? "§a✔ §f" : "§8✘ §7") + name);
    }

    @Override
    public void render(DrawContext ctx, int mouseX, int mouseY, float delta) {
        CabbageSkin.panel(ctx, panelX, panelY, PANEL_W, panelH);
        CabbageSkin.drawBird(ctx, panelX + 8, panelY + 6, 14);
        ctx.drawTextWithShadow(this.textRenderer, "BLOCK ESP", panelX + 27, panelY + 9, CabbageSkin.LIME);

        super.render(ctx, mouseX, mouseY, delta);

        // color swatch to the left of each block's button
        for (Entry e : entries) {
            int sx = e.button().getX() - 18;
            int sy = e.button().getY() + 4;
            ctx.fill(sx, sy, sx + 12, sy + 12, e.ore().color);
            CabbageSkin.border(ctx, sx, sy, 12, 12, 0xFF000000);
        }
    }

    @Override
    public void close() {
        if (this.client != null) {
            this.client.setScreen(parent);
        }
    }

    @Override
    public boolean shouldPause() {
        return false;
    }
}
