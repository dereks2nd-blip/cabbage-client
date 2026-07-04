package com.cabbage.hud.mixin;

import net.minecraft.client.render.Camera;
import net.minecraft.client.render.GameRenderer;
import org.spongepowered.asm.mixin.Mixin;
import org.spongepowered.asm.mixin.gen.Invoker;

/** Exposes GameRenderer's private getFov so ESP can build the exact projection matrix MC uses. */
@Mixin(GameRenderer.class)
public interface GameRendererAccessor {

    @Invoker("getFov")
    double cabbage$getFov(Camera camera, float tickDelta, boolean changingFov);
}
