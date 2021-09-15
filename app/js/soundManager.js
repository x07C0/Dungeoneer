
const dataaccess = require("./dataaccess");

class SoundManager {
    defaultSoundPath = pathModule.join(app.getAppPath(), 'app', 'mappingTool', 'sounds');
    soundProfiles = {
        "short": 50,
        "normal": 150,
        "far": 250,
        "everywhere": 5000,
    }
    getSoundProfiles() {
        return this.soundProfiles;
    }
    initialize() {
        this.sounds = [];
        this.globalListener = { x: 0, y: 0, z: 1 }
        this.muted = false;
        var cls = this;
        var musicButton = document.getElementById("music_button");
        if (musicButton)
            musicButton.onclick = () => cls.toggleMute();
    }

    effectZValue() {
        return 1;
    }
    adjustPlacement(elementId, x, y) {
        var found = this.sounds.find(x => x.elementId == elementId);
        var z = this.effectZValue() + Math.random();
        found.howl.pos(x, y, z, found.soundId);
    }
    toggleMute() {
        var btn = document.getElementById("music_button");
        this.muted = !this.muted;
        if (btn)
            btn.setAttribute("toggled", this.muted ? "false" : "true");
        Howler.mute(this.muted);
    }
    updatePlayingStatus() {
        var btn = document.getElementById("music_button");
        if (!btn)
            return;

        if (this.sounds.find(x => x.howl.playing())) {
            btn.classList.add("sounds_playing");
        } else {
            btn.classList.remove("sounds_playing");
        }
    }

    removeSound(soundId) {
        var found = this.sounds.find(x => x.soundId == soundId);
        if (!found) return;
        found.howl.unload()
        this.sounds = this.sounds.filter(x => x.soundId != soundId);
        this.updatePlayingStatus();
    }
    removeEffect(effect) {
        var found = this.sounds.find(x => x.elementId == effect.id);
        found.howl.unload()
        this.sounds = this.sounds.filter(x => x.elementId != effect.id);
        this.updatePlayingStatus();
    }

    globalVolume(volume){
        Howler.volume(volume);

    }

    addGlobalSound(src, volume) {
        var soundEffect = new Howl({
            src: [src],
            // html5: true,
            loop: true,
            volume: 0.75
        });

        var soundId = soundEffect.play();
        var cls = this;
        soundEffect.once('play', function () {
            soundEffect.volume(volume || 1, soundId);
            cls.updatePlayingStatus();
        });
        this.sounds.push(
            { howl: soundEffect, soundId: soundId }
        );
        return soundId;
    }

    async addEffect(effect, elementId) {
        var info = await this.getSoundInfo(effect.src);

        if(!info){
            console.log(`Sound ${effect.src} not found in library` )
        }
        var soundEffect = new Howl({
            src: [info.path],
            // html5: true,
            loop: true,
            volume: 0.75
        });

        var soundId = soundEffect.play();
        var cls = this;
        soundEffect.once('play', function () {
            // Set the position of the speaker in 3D space.
            soundEffect.pos(effect.x, effect.y, cls.effectZValue(), soundId);
            soundEffect.volume(effect.volume || 1, soundId);
            var refDist = cls.soundProfiles[effect.distance];
            soundEffect.pannerAttr({
                panningModel: 'equalpower',
                refDistance: refDist,
                rolloffFactor: 3,
                distanceModel: 'exponential'
            }, soundId);
            cls.updatePlayingStatus();
        });
        this.sounds.push(
            { howl: soundEffect, soundId: soundId, elementId: elementId }
        );
    }
    multiplier() {
        return 15;
    }
    setListenerCords(x, y, z) {
        console.log(x, y)
        if (x)
            this.globalListener.x = x;
        if (y)
            this.globalListener.y = y;
        if (z)
            this.globalListener.z = z;
        Howler.pos(this.globalListener.x, this.globalListener.y, this.globalListener.z);


    }

    async getSoundInfo(soundName) {
        var sounds = await this.getAvailableSounds();
        return sounds.find(x => {
            var basename = pathModule.basename(x.path);
            basename = basename.substring(0, basename.lastIndexOf("."));
            return soundName.toLowerCase() == basename.toLowerCase();
        });
    }

    async getAvailableSounds() {
        if (this.availableSoundList)
            return this.availableSoundList;
        var cls = this;
        var files = await dataaccess.getFiles(this.defaultSoundPath);

        var list = files.map(x => {
            var basename = pathModule.basename(x);
            var path = pathModule.join(cls.defaultSoundPath, basename);
            basename = basename.substring(0, basename.lastIndexOf("."));

            return { name: basename, path: path }

        });
        this.availableSoundList = list;
        return list;
    }

}
module.exports = SoundManager;