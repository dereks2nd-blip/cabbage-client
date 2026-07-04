package com.cabbage.hud;

import net.minecraft.client.font.TextRenderer;
import net.minecraft.client.gl.RenderPipelines;
import net.minecraft.client.gui.DrawContext;
import net.minecraft.client.gui.widget.ClickableWidget;
import net.minecraft.util.Identifier;

/**
 * Cabbage Client's widget skin — the Lunar-style custom look shared by the
 * title screen (via mixin) and the HUD editor. Chamfered pixel corners,
 * gradient bodies with a bevel, lime accents, and a tennis bird that hops
 * next to whatever button you're hovering.
 */
public final class CabbageSkin {

    public static final Identifier BIRD = Identifier.of("cabbage-hud", "textures/gui/bird.png");

    public static final int LIME = 0xFFB6F04A;
    public static final int LIME_SOFT = 0xFFDCFF9A;
    public static final int LIME_GLOW = 0x50B6F04A;
    public static final int TEXT = 0xFFE8F3EA;
    public static final int TEXT_DIM = 0xFF7C8A78;
    public static final int BORDER = 0xFF41682E;
    public static final int BORDER_DIM = 0xFF243024;

    private static final int BTN_TOP = 0xF0182617;
    private static final int BTN_BOTTOM = 0xF00C130D;
    private static final int BTN_TOP_HOVER = 0xF8263E1A;
    private static final int BTN_BOTTOM_HOVER = 0xF8142310;
    private static final int BTN_TOP_OFF = 0xE80D140F;
    private static final int BTN_BOTTOM_OFF = 0xE80A0F0A;

    /** 1px rectangle outline (sharp corners — used for HUD chips/handles). */
    public static void border(DrawContext ctx, int x, int y, int w, int h, int color) {
        ctx.fill(x, y, x + w, y + 1, color);
        ctx.fill(x, y + h - 1, x + w, y + h, color);
        ctx.fill(x, y + 1, x + 1, y + h - 1, color);
        ctx.fill(x + w - 1, y + 1, x + w, y + h - 1, color);
    }

    /**
     * A box with chamfered (pixel-rounded) corners: gradient body, border lines
     * that stop short of the corners, and a diagonal corner pixel — the classic
     * pixel-art rounded look. The 4 true corner pixels stay transparent.
     */
    public static void chamferBox(DrawContext ctx, int x, int y, int w, int h, int bgTop, int bgBottom, int border) {
        ctx.fillGradient(x + 1, y + 1, x + w - 1, y + h - 1, bgTop, bgBottom);
        ctx.fill(x + 2, y, x + w - 2, y + 1, border);
        ctx.fill(x + 2, y + h - 1, x + w - 2, y + h, border);
        ctx.fill(x, y + 2, x + 1, y + h - 2, border);
        ctx.fill(x + w - 1, y + 2, x + w, y + h - 2, border);
        ctx.fill(x + 1, y + 1, x + 2, y + 2, border);
        ctx.fill(x + w - 2, y + 1, x + w - 1, y + 2, border);
        ctx.fill(x + 1, y + h - 2, x + 2, y + h - 1, border);
        ctx.fill(x + w - 2, y + h - 2, x + w - 1, y + h - 1, border);
    }

    /** Bordered translucent panel with a header band (menu backdrop). */
    public static void panel(DrawContext ctx, int x, int y, int w, int h) {
        chamferBox(ctx, x, y, w, h, 0xEE0E1710, 0xEE0A100A, BORDER);
        // header band + divider
        ctx.fillGradient(x + 1, y + 1, x + w - 1, y + 25, 0x38213B1C, 0x10213B1C);
        ctx.fill(x + 1, y + 25, x + w - 1, y + 26, BORDER);
        ctx.fill(x + 2, y + 1, x + w - 2, y + 2, 0x30B6F04A); // top sheen
    }

    /** Draw a widget in the Cabbage style: chamfered gradient panel, bevel, hover bird. */
    public static void drawButton(DrawContext ctx, TextRenderer font, ClickableWidget w) {
        int x = w.getX();
        int y = w.getY();
        int ww = w.getWidth();
        int h = w.getHeight();
        boolean hover = w.isSelected() && w.active;

        if (hover) {
            // soft glow ring around the button
            chamferBox(ctx, x - 1, y - 1, ww + 2, h + 2, 0, 0, LIME_GLOW);
        }

        int bgTop = !w.active ? BTN_TOP_OFF : hover ? BTN_TOP_HOVER : BTN_TOP;
        int bgBottom = !w.active ? BTN_BOTTOM_OFF : hover ? BTN_BOTTOM_HOVER : BTN_BOTTOM;
        int bc = !w.active ? BORDER_DIM : hover ? LIME : BORDER;
        chamferBox(ctx, x, y, ww, h, bgTop, bgBottom, bc);

        // bevel: light catch on top, weight at the bottom
        ctx.fill(x + 2, y + 1, x + ww - 2, y + 2, 0x2CFFFFFF);
        ctx.fill(x + 2, y + h - 3, x + ww - 2, y + h - 1, 0x48000000);

        if (hover) {
            ctx.fill(x + 2, y + 3, x + 4, y + h - 3, LIME); // accent bar
        }

        int tc = !w.active ? TEXT_DIM : hover ? LIME_SOFT : TEXT;
        ctx.drawCenteredTextWithShadow(font, w.getMessage(), x + ww / 2, y + (h - 8) / 2, tc);

        if (hover) {
            drawBird(ctx, x - 18, y + (h - 14) / 2, 14);
        }
    }

    public static void drawBird(DrawContext ctx, int x, int y, int size) {
        ctx.drawTexture(RenderPipelines.GUI_TEXTURED, BIRD, x, y, 0f, 0f, size, size, 16, 16, 16, 16);
    }

    private CabbageSkin() {
    }
}
