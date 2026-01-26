export function fireProjectile(scene, x, y, target, hitAgainst)
{
    const radius = 6;
    const projectile = scene.add.circle(x, y, radius, 0xffdd00);
    scene.physics.add.existing(projectile);
    projectile.body.setCircle(radius);
    projectile.body.setAllowGravity(false);

    const speed = 500;
    scene.physics.moveToObject(projectile, target, speed);

    const ttl = 3000; // ms

    const destroyProjectile = () => {
        if (projectile && projectile.destroy)
        {
            projectile.destroy();
        }
    };

    // overlap handler: prefer calling object's `onHit` if present, otherwise apply generic health decrement
    const onHit = (proj, obj) => {
        if (!obj || !obj.active) return;

        if (typeof obj.onHit === 'function')
        {
            obj.onHit(proj);
        }
        else if (obj.health !== undefined)
        {
            obj.health = (obj.health || 1) - 1;
            if (obj.health <= 0)
            {
                obj.destroy();
            }
        }
        else
        {
            if (scene.player && typeof scene.player.onHit === 'function')
            {
                scene.player.onHit(obj);
            }
        }

        destroyProjectile();
    };

    // decide what to check overlap against
    const overlapTarget = hitAgainst || scene.enemies;
    scene.physics.add.overlap(projectile, overlapTarget, onHit);

    // lifespan timer
    scene.time.addEvent({
        delay: ttl,
        callback: destroyProjectile
    });

    return projectile;
}
