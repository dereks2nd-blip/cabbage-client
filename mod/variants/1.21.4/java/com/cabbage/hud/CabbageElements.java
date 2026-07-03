package com.cabbage.hud;

import net.minecraft.client.MinecraftClient;
import net.minecraft.client.font.TextRenderer;
import net.minecraft.client.gui.DrawContext;
import net.minecraft.client.network.PlayerListEntry;
import net.minecraft.client.option.KeyBinding;
import net.minecraft.entity.EquipmentSlot;
import net.minecraft.entity.effect.StatusEffectInstance;
import net.minecraft.item.ItemStack;
import net.minecraft.util.StringHelper;
import net.minecraft.util.math.BlockPos;
import net.minecraft.util.math.Direction;

import java.util.ArrayDeque;
import java.util.ArrayList;
import java.util.Deque;
import java.util.List;

/** All HUD widgets. Each is toggleable + positioned via {@link CabbageConfig}. */
public final class CabbageElements {

    static final int GREEN = 0xFFB6F04A;
    static final int WHITE = 0xFFE8F3EA;
    static final int RED = 0xFFF06A4A;
    static final int PANEL = 0xC0101A12;
    static final int PANEL_BORDER = 0xFF2E4A24;

    /** Click timestamps for the CPS counter (fed by CabbageHudClient's tick handler). */
    static final Deque<Long> LEFT_CLICKS = new ArrayDeque<>();
    static final Deque<Long> RIGHT_CLICKS = new ArrayDeque<>();

    static int cps(Deque<Long> clicks) {
        long now = System.currentTimeMillis();
        clicks.removeIf(t -> now - t > 1000);
        return clicks.size();
    }

    public abstract static class HudElement {
        public final String id;
        public final String label;
        public final int defX;
        public final int defY;

        protected HudElement(String id, String label, int defX, int defY) {
            this.id = id;
            this.label = label;
            this.defX = defX;
            this.defY = defY;
        }

        public abstract int width(MinecraftClient mc, TextRenderer font);

        public abstract int height(MinecraftClient mc, TextRenderer font);

        public abstract void render(DrawContext ctx, TextRenderer font, MinecraftClient mc, int x, int y);

        /**
         * A themed chip: bordered dark panel with a colored accent bar on the
         * left. `accent` is the bar color; the text itself stays bright.
         */
        protected void chip(DrawContext ctx, TextRenderer font, String text, int x, int y, int accent) {
            int w = font.getWidth(text) + 11;
            CabbageSkin.chamferBox(ctx, x, y, w, 13, PANEL, PANEL, PANEL_BORDER);
            ctx.fill(x + 1, y + 2, x + 3, y + 11, accent);
            ctx.drawTextWithShadow(font, text, x + 6, y + 3, WHITE);
        }

        protected int chipWidth(TextRenderer font, String text) {
            return font.getWidth(text) + 11;
        }
    }

    public static List<HudElement> all() {
        return List.of(
                new Fps(),
                new Coords(),
                new DirectionElem(),
                new Cps(),
                new Sprint(),
                new Armor(),
                new Ping(),
                new Memory(),
                new Clock(),
                new Potions(),
                new Keystrokes()
        );
    }

    /** True while the HUD editor is open — placeholder-render empty elements so they stay draggable. */
    static boolean editing(MinecraftClient mc) {
        return mc.currentScreen instanceof CabbageHudScreen;
    }

    /** Simple one-line text chip element. */
    abstract static class TextChip extends HudElement {
        private final int accent;

        TextChip(String id, String label, int defX, int defY, int accent) {
            super(id, label, defX, defY);
            this.accent = accent;
        }

        abstract String text(MinecraftClient mc);

        public int width(MinecraftClient mc, TextRenderer font) {
            return chipWidth(font, text(mc));
        }

        public int height(MinecraftClient mc, TextRenderer font) {
            return 13;
        }

        public void render(DrawContext ctx, TextRenderer font, MinecraftClient mc, int x, int y) {
            chip(ctx, font, text(mc), x, y, accent);
        }
    }

    // ---- text chips ----

    static class Fps extends TextChip {
        Fps() {
            super("fps", "FPS", 4, 4, GREEN);
        }

        String text(MinecraftClient mc) {
            return mc.getCurrentFps() + " FPS";
        }
    }

    static class Coords extends TextChip {
        Coords() {
            super("coords", "Coordinates", 4, 19, WHITE);
        }

        String text(MinecraftClient mc) {
            BlockPos p = mc.player.getBlockPos();
            return "XYZ " + p.getX() + " " + p.getY() + " " + p.getZ();
        }
    }

    static class DirectionElem extends TextChip {
        DirectionElem() {
            super("direction", "Direction", 4, 34, WHITE);
        }

        String text(MinecraftClient mc) {
            Direction d = mc.player.getHorizontalFacing();
            String name = switch (d) {
                case NORTH -> "North (-Z)";
                case SOUTH -> "South (+Z)";
                case EAST -> "East (+X)";
                case WEST -> "West (-X)";
                default -> d.asString();
            };
            return "Facing " + name;
        }
    }

    static class Cps extends TextChip {
        Cps() {
            super("cps", "CPS", 4, 49, GREEN);
        }

        String text(MinecraftClient mc) {
            return cps(LEFT_CLICKS) + " | " + cps(RIGHT_CLICKS) + " CPS";
        }
    }

    static class Sprint extends TextChip {
        Sprint() {
            super("sprint", "Sprint indicator", 4, 64, GREEN);
        }

        String text(MinecraftClient mc) {
            if (mc.player.isSprinting()) {
                return "Sprinting";
            }
            return mc.player.isSneaking() ? "Sneaking" : "Walking";
        }
    }

    static class Ping extends TextChip {
        Ping() {
            super("ping", "Ping", 4, 172, GREEN);
        }

        String text(MinecraftClient mc) {
            var handler = mc.getNetworkHandler();
            PlayerListEntry entry = handler == null ? null : handler.getPlayerListEntry(mc.player.getUuid());
            return (entry == null ? "--" : entry.getLatency()) + " ms";
        }
    }

    static class Memory extends TextChip {
        Memory() {
            super("memory", "Memory", 4, 187, WHITE);
        }

        String text(MinecraftClient mc) {
            Runtime rt = Runtime.getRuntime();
            long used = (rt.totalMemory() - rt.freeMemory()) / 1048576L;
            long max = rt.maxMemory() / 1048576L;
            return "Mem " + used + "/" + max + " MB";
        }
    }

    static class Clock extends TextChip {
        Clock() {
            super("clock", "World clock", 4, 202, WHITE);
        }

        String text(MinecraftClient mc) {
            long t = mc.world.getTimeOfDay() % 24000L;
            int h = (int) ((t / 1000L + 6) % 24);
            int m = (int) (t % 1000L * 60L / 1000L);
            return String.format("%02d:%02d", h, m);
        }
    }

    // ---- active potion effects (stacked chips) ----

    static class Potions extends HudElement {
        Potions() {
            super("potions", "Potion effects", 80, 4);
        }

        private List<String> lines(MinecraftClient mc) {
            List<String> out = new ArrayList<>();
            for (StatusEffectInstance fx : mc.player.getStatusEffects()) {
                String name = fx.getEffectType().value().getName().getString();
                if (fx.getAmplifier() > 0) {
                    name += " " + (fx.getAmplifier() + 1);
                }
                String time = fx.isInfinite() ? "∞" : StringHelper.formatTicks(fx.getDuration(), 20f);
                out.add(name + " " + time);
            }
            if (out.isEmpty() && editing(mc)) {
                out.add("No effects");
            }
            return out;
        }

        public int width(MinecraftClient mc, TextRenderer font) {
            int w = 40;
            for (String l : lines(mc)) {
                w = Math.max(w, chipWidth(font, l));
            }
            return w;
        }

        public int height(MinecraftClient mc, TextRenderer font) {
            return Math.max(1, lines(mc).size()) * 15 - 2;
        }

        public void render(DrawContext ctx, TextRenderer font, MinecraftClient mc, int x, int y) {
            int yy = y;
            for (String l : lines(mc)) {
                chip(ctx, font, l, x, yy, 0xFFCE64E8);
                yy += 15;
            }
        }
    }

    // ---- keystrokes block ----

    static class Keystrokes extends HudElement {
        Keystrokes() {
            super("keystrokes", "Keystrokes", 16, 140);
        }

        public int width(MinecraftClient mc, TextRenderer font) {
            return 68;
        }

        public int height(MinecraftClient mc, TextRenderer font) {
            return 66;
        }

        public void render(DrawContext ctx, TextRenderer font, MinecraftClient mc, int x, int y) {
            var o = mc.options;
            box(ctx, font, "W", x + 24, y, 20, 20, o.forwardKey);
            box(ctx, font, "A", x, y + 22, 20, 20, o.leftKey);
            box(ctx, font, "S", x + 24, y + 22, 20, 20, o.backKey);
            box(ctx, font, "D", x + 48, y + 22, 20, 20, o.rightKey);
            box(ctx, font, "LMB", x, y + 44, 32, 20, o.attackKey);
            box(ctx, font, "RMB", x + 36, y + 44, 32, 20, o.useKey);
        }

        private void box(DrawContext ctx, TextRenderer font, String label, int x, int y, int w, int h, KeyBinding key) {
            boolean pressed = key.isPressed();
            if (pressed) {
                CabbageSkin.chamferBox(ctx, x, y, w, h, 0xF0CFF76A, 0xF0A4D93E, 0xFFDCFF9A);
            } else {
                CabbageSkin.chamferBox(ctx, x, y, w, h, 0xC8162113, 0xC80D140D, PANEL_BORDER);
            }
            int fg = pressed ? 0xFF14180A : WHITE;
            int tw = font.getWidth(label);
            ctx.drawTextWithShadow(font, label, x + (w - tw) / 2, y + (h - 8) / 2, fg);
        }
    }

    // ---- armor with durability ----

    static class Armor extends HudElement {
        private static final EquipmentSlot[] SLOTS = {
                EquipmentSlot.HEAD, EquipmentSlot.CHEST, EquipmentSlot.LEGS, EquipmentSlot.FEET
        };

        Armor() {
            super("armor", "Armor status", 4, 84);
        }

        public int width(MinecraftClient mc, TextRenderer font) {
            return 20;
        }

        public int height(MinecraftClient mc, TextRenderer font) {
            return 4 * 20;
        }

        public void render(DrawContext ctx, TextRenderer font, MinecraftClient mc, int x, int y) {
            int row = 0;
            for (EquipmentSlot slot : SLOTS) {
                ItemStack stack = mc.player.getEquippedStack(slot);
                int yy = y + row * 20;
                if (!stack.isEmpty()) {
                    ctx.drawItem(stack, x, yy);
                    ctx.drawStackOverlay(font, stack, x, yy);
                    if (stack.isDamageable()) {
                        int left = stack.getMaxDamage() - stack.getDamage();
                        int color = left < stack.getMaxDamage() / 4 ? RED : WHITE;
                        ctx.drawTextWithShadow(font, String.valueOf(left), x + 20, yy + 4, color);
                    }
                } else if (editing(mc)) {
                    ctx.fill(x, yy, x + 16, yy + 16, PANEL);
                    CabbageSkin.border(ctx, x, yy, 16, 16, PANEL_BORDER);
                }
                row++;
            }
        }
    }

    private CabbageElements() {
    }
}
