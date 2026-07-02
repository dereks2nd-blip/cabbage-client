package com.cabbage.hud;

import com.cabbage.hud.mixin.GameRendererAccessor;
import net.minecraft.block.Block;
import net.minecraft.block.Blocks;
import net.minecraft.client.MinecraftClient;
import net.minecraft.client.gui.DrawContext;
import net.minecraft.client.network.AbstractClientPlayerEntity;
import net.minecraft.client.render.Camera;
import net.minecraft.util.math.BlockPos;
import net.minecraft.util.math.Box;
import net.minecraft.util.math.Vec3d;
import org.joml.Matrix4f;
import org.joml.Vector4f;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

/**
 * Player + block (ore) ESP for the Cabbage HUD. 1.21.11's render pipeline
 * dropped the easy 3D line API, so this projects world points to 2D screen
 * space and draws boxes on the HUD layer — which shows through walls for free.
 *
 * The projection is built from scratch each frame off the camera's own
 * pitch/yaw + FOV (the canonical world→screen transform), so it does NOT depend
 * on any render-pass matrix state — that was the bug in the first version.
 *
 * FOR DEMOS / SINGLEPLAYER. Toggling ESP on an anticheat server can get the
 * account banned; everything defaults OFF.
 */
public final class CabbageEsp {

    private static final int PLAYER_LINE = 0xFFFF4A4A;
    private static final int PLAYER_FILL = 0x28FF4A4A;

    // ---- selectable ore types ----

    /** A highlightable ore: a stable key, display name, box color, and its block variants. */
    public static final class Ore {
        public final String key;
        public final String name;
        public final int color;
        public final boolean defaultOn;
        final Block[] blocks;

        Ore(String key, String name, int color, boolean defaultOn, Block... blocks) {
            this.key = key;
            this.name = name;
            this.color = color;
            this.defaultOn = defaultOn;
            this.blocks = blocks;
        }
    }

    public static final List<Ore> ORE_TYPES = List.of(
            new Ore("diamond", "Diamond", 0xFF4AF0E6, true, Blocks.DIAMOND_ORE, Blocks.DEEPSLATE_DIAMOND_ORE),
            new Ore("netherite", "Ancient Debris", 0xFFB0603A, true, Blocks.ANCIENT_DEBRIS),
            new Ore("emerald", "Emerald", 0xFF3BF06A, true, Blocks.EMERALD_ORE, Blocks.DEEPSLATE_EMERALD_ORE),
            new Ore("gold", "Gold", 0xFFF0D24A, true, Blocks.GOLD_ORE, Blocks.DEEPSLATE_GOLD_ORE, Blocks.NETHER_GOLD_ORE),
            new Ore("iron", "Iron", 0xFFE8C9A0, false, Blocks.IRON_ORE, Blocks.DEEPSLATE_IRON_ORE),
            new Ore("lapis", "Lapis", 0xFF3A6BF0, false, Blocks.LAPIS_ORE, Blocks.DEEPSLATE_LAPIS_ORE),
            new Ore("redstone", "Redstone", 0xFFF04A4A, false, Blocks.REDSTONE_ORE, Blocks.DEEPSLATE_REDSTONE_ORE),
            new Ore("copper", "Copper", 0xFFE0885A, false, Blocks.COPPER_ORE, Blocks.DEEPSLATE_COPPER_ORE),
            new Ore("coal", "Coal", 0xFF6A6A6A, false, Blocks.COAL_ORE, Blocks.DEEPSLATE_COAL_ORE),
            new Ore("chests", "Chests", 0xFFE0A83A, true, Blocks.CHEST, Blocks.TRAPPED_CHEST, Blocks.ENDER_CHEST, Blocks.BARREL),
            new Ore("shulkers", "Shulker Boxes", 0xFFC060E0, true,
                    Blocks.SHULKER_BOX, Blocks.WHITE_SHULKER_BOX, Blocks.ORANGE_SHULKER_BOX, Blocks.MAGENTA_SHULKER_BOX,
                    Blocks.LIGHT_BLUE_SHULKER_BOX, Blocks.YELLOW_SHULKER_BOX, Blocks.LIME_SHULKER_BOX, Blocks.PINK_SHULKER_BOX,
                    Blocks.GRAY_SHULKER_BOX, Blocks.LIGHT_GRAY_SHULKER_BOX, Blocks.CYAN_SHULKER_BOX, Blocks.PURPLE_SHULKER_BOX,
                    Blocks.BLUE_SHULKER_BOX, Blocks.BROWN_SHULKER_BOX, Blocks.GREEN_SHULKER_BOX, Blocks.RED_SHULKER_BOX,
                    Blocks.BLACK_SHULKER_BOX),
            new Ore("obsidian", "Obsidian", 0xFF9B6BF0, false, Blocks.OBSIDIAN, Blocks.CRYING_OBSIDIAN)
    );

    private static final Map<Block, Ore> BY_BLOCK = new HashMap<>();

    static {
        for (Ore ore : ORE_TYPES) {
            for (Block b : ore.blocks) {
                BY_BLOCK.put(b, ore);
            }
        }
    }

    // ---- ore scan cache (refreshed on a throttle) ----

    private static final List<BlockPos> ORES = new ArrayList<>();
    private static int scanCooldown;
    private static final int SCAN_RADIUS = 18;
    private static final int SCAN_INTERVAL_TICKS = 20;

    /** Force the next tick to rescan (call after toggling which ores are shown). */
    public static void requestRescan() {
        scanCooldown = 0;
    }

    /** Rescan nearby selected ores on a throttle. Call every client tick. */
    public static void tick(MinecraftClient mc) {
        if (!CabbageConfig.get().blockEsp || mc.world == null || mc.player == null) {
            return;
        }
        if (--scanCooldown > 0) {
            return;
        }
        scanCooldown = SCAN_INTERVAL_TICKS;
        CabbageConfig cfg = CabbageConfig.get();

        ORES.clear();
        BlockPos.Mutable p = new BlockPos.Mutable();
        BlockPos center = mc.player.getBlockPos();
        int r = SCAN_RADIUS;
        for (int dx = -r; dx <= r; dx++) {
            for (int dy = -r; dy <= r; dy++) {
                for (int dz = -r; dz <= r; dz++) {
                    p.set(center.getX() + dx, center.getY() + dy, center.getZ() + dz);
                    Ore ore = BY_BLOCK.get(mc.world.getBlockState(p).getBlock());
                    if (ore != null && cfg.espBlockEnabled(ore.key, ore.defaultOn)) {
                        ORES.add(p.toImmutable());
                        if (ORES.size() >= 800) {
                            return;
                        }
                    }
                }
            }
        }
    }

    /** Draw ESP boxes. Call from the HUD render pass (works even with HUD hidden). */
    public static void render(DrawContext ctx, MinecraftClient mc, float tickDelta) {
        if (mc.world == null || mc.player == null) {
            return;
        }
        CabbageConfig cfg = CabbageConfig.get();
        if (!cfg.playerEsp && !cfg.blockEsp) {
            return;
        }

        Camera cam = mc.gameRenderer.getCamera();
        Vec3d camPos = cam.getCameraPos();
        float fov = ((GameRendererAccessor) mc.gameRenderer).cabbage$getFov(cam, tickDelta, true);
        Matrix4f combined = new Matrix4f(mc.gameRenderer.getBasicProjectionMatrix(fov));
        // world → view: rotate by the camera's pitch then (yaw + 180), exactly as
        // GameRenderer builds the view matrix. Translation is handled per-point
        // by subtracting the camera position.
        combined.rotateX((float) Math.toRadians(cam.getPitch()));
        combined.rotateY((float) Math.toRadians(cam.getYaw() + 180.0f));

        int sw = mc.getWindow().getScaledWidth();
        int sh = mc.getWindow().getScaledHeight();

        if (cfg.blockEsp) {
            // Clean outlined 2D boxes — crisp axis-aligned lines, distance-culled
            // and capped so a cave full of ore can't wreck the frame rate.
            int drawn = 0;
            for (BlockPos pos : ORES) {
                if (drawn >= 300) {
                    break;
                }
                Ore ore = BY_BLOCK.get(mc.world.getBlockState(pos).getBlock());
                if (ore == null || !cfg.espBlockEnabled(ore.key, ore.defaultOn)) {
                    continue;
                }
                if (camPos.squaredDistanceTo(pos.getX() + 0.5, pos.getY() + 0.5, pos.getZ() + 0.5) > 32 * 32) {
                    continue;
                }
                Box box = new Box(pos.getX(), pos.getY(), pos.getZ(),
                        pos.getX() + 1, pos.getY() + 1, pos.getZ() + 1);
                int[] r = projectAabb(box, combined, camPos, sw, sh);
                if (r == null) {
                    continue;
                }
                drawBox2D(ctx, r[0], r[1], r[2], r[3], ore.color, 0);
                drawn++;
            }
        }

        if (cfg.playerEsp) {
            for (AbstractClientPlayerEntity player : mc.world.getPlayers()) {
                // Show sneaking + invisible players too — skip only self/spectators.
                if (player == mc.player || player.isSpectator()) {
                    continue;
                }
                Vec3d lerp = player.getLerpedPos(tickDelta);
                Box box = player.getBoundingBox().offset(lerp.subtract(player.getEntityPos()));
                int[] r = projectAabb(box, combined, camPos, sw, sh);
                if (r == null) {
                    continue;
                }
                drawBox2D(ctx, r[0], r[1], r[2], r[3], PLAYER_LINE, PLAYER_FILL);
                int dist = (int) mc.player.distanceTo(player);
                String label = player.getName().getString() + "  " + dist + "m"
                        + (player.isInvisible() ? " §7(invis)" : "");
                ctx.drawCenteredTextWithShadow(mc.textRenderer, label, (r[0] + r[2]) / 2, r[1] - 11, PLAYER_LINE);
            }
        }
    }

    /** Project a 3D box to a screen-space AABB. Null if any corner is behind the camera or it's off-screen. */
    private static int[] projectAabb(Box box, Matrix4f mvp, Vec3d camPos, int sw, int sh) {
        float minX = Float.MAX_VALUE, minY = Float.MAX_VALUE;
        float maxX = -Float.MAX_VALUE, maxY = -Float.MAX_VALUE;
        double[] xs = {box.minX, box.maxX};
        double[] ys = {box.minY, box.maxY};
        double[] zs = {box.minZ, box.maxZ};
        for (int i = 0; i < 8; i++) {
            float[] s = worldToScreen(xs[i & 1], ys[(i >> 1) & 1], zs[(i >> 2) & 1], mvp, camPos, sw, sh);
            if (s == null) {
                return null; // corner behind the camera — skip whole box (no smearing)
            }
            minX = Math.min(minX, s[0]);
            minY = Math.min(minY, s[1]);
            maxX = Math.max(maxX, s[0]);
            maxY = Math.max(maxY, s[1]);
        }
        int x1 = (int) Math.floor(minX), y1 = (int) Math.floor(minY);
        int x2 = (int) Math.ceil(maxX), y2 = (int) Math.ceil(maxY);
        if (x2 - x1 < 1 || y2 - y1 < 1) {
            return null;
        }
        if (x2 < 0 || y2 < 0 || x1 > sw || y1 > sh) {
            return null; // fully off-screen
        }
        if (x2 - x1 > sw * 2 || y2 - y1 > sh * 2) {
            return null; // sanity guard against absurd projections
        }
        return new int[]{x1, y1, x2, y2};
    }

    /** Crisp outlined box: dark contrast border, colored outline, bright corner brackets, optional fill. */
    private static void drawBox2D(DrawContext ctx, int x1, int y1, int x2, int y2, int color, int fill) {
        if (fill != 0) {
            ctx.fill(x1, y1, x2, y2, fill);
        }
        outline(ctx, x1 - 1, y1 - 1, x2 + 1, y2 + 1, 0xC0000000); // contrast so it reads on any bg
        outline(ctx, x1, y1, x2, y2, color);

        int len = Math.max(3, Math.min(7, Math.min(x2 - x1, y2 - y1) / 3));
        ctx.fill(x1, y1, x1 + len, y1 + 2, color);
        ctx.fill(x1, y1, x1 + 2, y1 + len, color);
        ctx.fill(x2 - len, y1, x2, y1 + 2, color);
        ctx.fill(x2 - 2, y1, x2, y1 + len, color);
        ctx.fill(x1, y2 - 2, x1 + len, y2, color);
        ctx.fill(x1, y2 - len, x1 + 2, y2, color);
        ctx.fill(x2 - len, y2 - 2, x2, y2, color);
        ctx.fill(x2 - 2, y2 - len, x2, y2, color);
    }

    private static void outline(DrawContext ctx, int x1, int y1, int x2, int y2, int color) {
        ctx.fill(x1, y1, x2, y1 + 1, color);
        ctx.fill(x1, y2 - 1, x2, y2, color);
        ctx.fill(x1, y1, x1 + 1, y2, color);
        ctx.fill(x2 - 1, y1, x2, y2, color);
    }

    /** World point → screen pixel via the combined MVP. Null if behind the near plane. */
    private static float[] worldToScreen(double x, double y, double z, Matrix4f mvp, Vec3d camPos, int sw, int sh) {
        Vector4f v = new Vector4f(
                (float) (x - camPos.x), (float) (y - camPos.y), (float) (z - camPos.z), 1f);
        v.mul(mvp);
        if (v.w() <= 0.0001f) {
            return null;
        }
        float ndcX = v.x() / v.w();
        float ndcY = v.y() / v.w();
        return new float[]{
                (ndcX * 0.5f + 0.5f) * sw,
                (1.0f - (ndcY * 0.5f + 0.5f)) * sh
        };
    }

    private CabbageEsp() {
    }
}
