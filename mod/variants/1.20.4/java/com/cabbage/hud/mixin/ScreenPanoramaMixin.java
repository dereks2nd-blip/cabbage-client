package com.cabbage.hud.mixin;

import com.cabbage.hud.CabbageSkin;
import net.minecraft.client.gui.DrawContext;
import net.minecraft.client.gui.RotatingCubeMapRenderer;
import net.minecraft.client.gui.screen.TitleScreen;
import net.minecraft.util.Identifier;
import org.spongepowered.asm.mixin.Mixin;
import org.spongepowered.asm.mixin.Unique;
import org.spongepowered.asm.mixin.injection.At;
import org.spongepowered.asm.mixin.injection.Inject;
import org.spongepowered.asm.mixin.injection.Redirect;
import org.spongepowered.asm.mixin.injection.callback.CallbackInfo;

/**
 * 1.20.1 port of the custom title screen. This version has no
 * Screen.renderPanoramaBackground — TitleScreen.render calls its
 * RotatingCubeMapRenderer directly — so instead we no-op that call via
 * @Redirect and draw the flat pixel-art scene at the top of render()
 * (everything else — logo, splash, buttons, fade overlay — draws over it).
 */
@Mixin(TitleScreen.class)
public abstract class ScreenPanoramaMixin {

    @Unique
    private static final Identifier CABBAGE_TITLE_BG =
            new Identifier("cabbage-hud", "textures/gui/title_background.png");

    @Unique
    private static final int CABBAGE_TEX_W = 960;

    @Unique
    private static final int CABBAGE_TEX_H = 540;

    @Redirect(method = "render", at = @At(value = "INVOKE",
            target = "Lnet/minecraft/client/gui/RotatingCubeMapRenderer;render(FF)V"))
    private void cabbage$noPanorama(RotatingCubeMapRenderer renderer, float delta, float alpha) {
        // replaced by the flat backdrop drawn in cabbage$titleBackground
    }

    @Inject(method = "render", at = @At("HEAD"))
    private void cabbage$titleBackground(DrawContext ctx, int mouseX, int mouseY, float delta, CallbackInfo ci) {
        TitleScreen self = (TitleScreen) (Object) this;
        int sw = self.width;
        int sh = self.height;
        if (sw <= 0 || sh <= 0) {
            return;
        }
        // cover-fit: scale the art to fill the screen and center the overflow
        float scale = Math.max(sw / (float) CABBAGE_TEX_W, sh / (float) CABBAGE_TEX_H);
        int dw = (int) Math.ceil(CABBAGE_TEX_W * scale);
        int dh = (int) Math.ceil(CABBAGE_TEX_H * scale);
        ctx.drawTexture(CABBAGE_TITLE_BG,
                (sw - dw) / 2, (sh - dh) / 2, dw, dh, 0f, 0f,
                CABBAGE_TEX_W, CABBAGE_TEX_H, CABBAGE_TEX_W, CABBAGE_TEX_H);

        // branding badge, top-left (drawn under the logo/widgets)
        CabbageSkin.drawBird(ctx, 5, 5, 16);
        ctx.drawTextWithShadow(net.minecraft.client.MinecraftClient.getInstance().textRenderer,
                "CABBAGE CLIENT", 25, 9, CabbageSkin.LIME);
    }
}
