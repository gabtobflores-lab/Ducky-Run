// Sound: the same little synthesized tones as the web version (sine, triangle, sawtooth and square blips with pitch slides),
// plus the soft low thunder rumble, generated live with AVAudioEngine. No sound files needed.

import AVFoundation
import Combine

final class Synth {
    static let shared = Synth()

    private struct Voice {
        var noise: Bool
        var wave: Wave3 = .sine
        var f0 = 440.0, f1 = 440.0, d = 0.1, vol = 0.05
        var delay = 0     // samples to wait before starting
        var start: Int64 = -1
        var phase = 0.0
        var brown = 0.0, lp1 = 0.0, lp2 = 0.0   // thunder: brown noise through two low-pass stages
    }

    private let engine = AVAudioEngine()
    private var node: AVAudioSourceNode?
    private let lock = NSLock()
    private var incoming: [Voice] = []
    private var voices: [Voice] = []      // touched only on the audio thread
    private var clock: Int64 = 0
    private var sr = 44100.0
    private var started = false

    private init() {}

    func start() {
        guard !started else { return }
        started = true
        try? AVAudioSession.sharedInstance().setCategory(.ambient, options: [.mixWithOthers])   // plays alongside music and respects the silent switch
        try? AVAudioSession.sharedInstance().setActive(true)
        sr = engine.outputNode.outputFormat(forBus: 0).sampleRate
        if sr <= 0 { sr = 44100 }
        guard let fmt = AVAudioFormat(standardFormatWithSampleRate: sr, channels: 1) else { return }
        let n = AVAudioSourceNode(format: fmt) { [unowned self] _, _, frameCount, abl -> OSStatus in
            self.render(Int(frameCount), UnsafeMutableAudioBufferListPointer(abl))
            return noErr
        }
        node = n
        engine.attach(n)
        engine.connect(n, to: engine.mainMixerNode, format: fmt)
        engine.mainMixerNode.outputVolume = 1
        try? engine.start()
        NotificationCenter.default.addObserver(forName: AVAudioSession.interruptionNotification, object: nil, queue: .main) { [weak self] _ in self?.resume() }
    }

    /// iOS stops audio after calls and when the app was in the background
    func resume() { if started && !engine.isRunning { try? AVAudioSession.sharedInstance().setActive(true); try? engine.start() } }

    func beep(_ f: Double, _ d: Double, _ wave: Wave3, _ vol: Double, _ slide: Double, delay: Double = 0) {
        start(); resume()
        var v = Voice(noise: false); v.wave = wave; v.f0 = f; v.f1 = slide != 0 ? max(30, f + slide) : f; v.d = d; v.vol = vol; v.delay = Int(delay * sr)
        lock.lock(); incoming.append(v); lock.unlock()
    }
    func thunder(delay: Double, vol: Double, len: Double) {
        start(); resume()
        var v = Voice(noise: true); v.d = len; v.vol = vol; v.delay = Int(delay * sr)
        lock.lock(); incoming.append(v); lock.unlock()
    }

    private func render(_ frames: Int, _ buffers: UnsafeMutableAudioBufferListPointer) {
        if lock.try() { if !incoming.isEmpty { for var v in incoming { v.start = clock + Int64(v.delay); voices.append(v) }; incoming.removeAll(keepingCapacity: true) }; lock.unlock() }
        guard let buf = buffers.first, let data = buf.mData?.assumingMemoryBound(to: Float.self) else { return }
        for i in 0..<frames { data[i] = 0 }
        if voices.isEmpty { clock += Int64(frames); return }
        let twoPi = 2 * Double.pi
        for vi in voices.indices {
            var v = voices[vi]
            for i in 0..<frames {
                let tt = Double(clock + Int64(i) - v.start) / sr
                if tt < 0 || tt >= v.d { continue }
                var s = 0.0
                if v.noise {
                    // swells in, holds, then rolls away; the low-pass closes from 320 Hz to 90 Hz
                    let g: Double
                    if tt < 0.12 { g = 0.0001 * pow(v.vol / 0.0001, tt / 0.12) }
                    else if tt < 0.5 { g = v.vol * pow(0.5, (tt - 0.12) / 0.38) }
                    else { g = v.vol * 0.5 * pow(0.0001 / (v.vol * 0.5), (tt - 0.5) / max(0.01, v.d - 0.5)) }
                    let fc = 320 * pow(90.0 / 320.0, tt / v.d), a = 1 - exp(-twoPi * fc / sr)
                    v.brown = v.brown * 0.985 + (Double.random(in: -1...1)) * 0.15
                    v.lp1 += a * (v.brown - v.lp1); v.lp2 += a * (v.lp1 - v.lp2)
                    s = v.lp2 * g * 6
                } else {
                    let f = v.f0 == v.f1 ? v.f0 : v.f0 * pow(v.f1 / v.f0, tt / v.d)
                    let g = v.vol * pow(0.0001 / v.vol, tt / v.d)
                    v.phase += f / sr; if v.phase > 1 { v.phase -= floor(v.phase) }
                    let p = v.phase
                    switch v.wave {
                    case .sine: s = sin(twoPi * p)
                    case .triangle: s = 1 - 4 * abs(p - 0.5)
                    case .sawtooth: s = (2 * p - 1) * 0.8
                    case .square: s = (p < 0.5 ? 1 : -1) * 0.7
                    }
                    s *= g
                }
                data[i] += Float(s)
            }
            voices[vi] = v
        }
        clock += Int64(frames)
        voices.removeAll { Double(clock - $0.start) / sr >= $0.d }
        for i in 1..<buffers.count { if let d2 = buffers[i].mData { memcpy(d2, data, Int(buffers[i].mDataByteSize)) } }
    }
}
