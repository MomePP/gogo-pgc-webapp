export interface LogoProgramSettings {
    channel: string
    playbackWait: number
    turnWait: number
    moveWait: number
}

export const generateLogoCode = (config: LogoProgramSettings): string => {
    return `to start
    set command 0
    set commands "0001"
    set forward2 "F"
    set backward "B"
    set left "L"
    set right "R"
    set stop2 "S"
    set program_run "run"
    set program_stop "stop"
    set beep_key "P"
    set program_repeat 1
    set playback_wait (${config.playbackWait}) 
    set move_wait (${config.moveWait}) 
    set turn_wait (${config.turnWait}) 
    set is_record 0
    set is_playback 0
    set i 0
    set action 0
    set index 0
    set ir_code 0
    subscribemessage "gogo-pgc/blockly/${config.channel}"
    [
        beep
        wait 60
        beep
        set commands (message)
        set program_repeat tonumber(( ( ( (textat commands (0)) + (textat commands (1)) ) + (textat commands (2)) ) + (textat commands (3)) )) 
        set index (4) 
        show program_repeat
    ]
    subscribemessage "gogo-pgc/control/${config.channel}"
    [
        if ( message = program_run )
        [
            set is_playback (1) 
        ]
        if ( message = program_stop )
        [
            set is_playback (0) 
        ]
    ]
    dobackground
    [
        forever
        [
            if newir?
            [
                set i (ir) 
            ]
            wait 100
        ]
    ]
    output1234,
    setpower 60
    forever
    [
        ifstatechange (newir?)
        [
            beep
            set ir_code (ir) 
            _if ( ir_code = 22 )
            [
                set is_record (1) 
                show "recording "
            ]
            _then ( ir_code = 13 )
            [
                set is_record (0) 
                publish_commands
                show "--- "
            ]
            _then ( ir_code = 69 )
            [
                set is_playback (1) 
            ]
            _then ( ir_code = 25 )
            [
                set is_playback (0)
                clear_playback
                show "clear playback "
            ]
            _then ( ir_code = 24 )
            [
                move_forward
            ]
            _then ( ir_code = 82 )
            [
                move_backward
            ]
            _then ( ir_code = 8 )
            [
                move_left
            ]
            _then ( ir_code = 90 )
            [
                move_right
            ]
            _then ( ir_code = 28 )
            [
                move_stop
            ]
        ]
        if is_playback
        [
            show "playback"
            wait 300
            playback
            set is_playback (0) 
        ]
    ]
end

to publish_commands
    beep
    wait 40
    beep
    publishmessage "gogo-pgc/remote/${config.channel}" commands
end

to clear_playback
    set commands "0001"
end

to playback
    set is_record (0) 
    show (textlength commands)
    wait 200
    repeat (program_repeat)
    [
        if not is_playback
        [
            show "finished"
            break
        ]

        repeat ((textlength commands) - 4)
        [
            if not is_playback
            [
                show "finished"
                break
            ]

            set action ((textat commands index)) 
            show action
            _if ( action = forward2 )
            [
                move_forward
            ]
            _then ( action = backward )
            [
                move_backward
            ]
            _then ( action = left )
            [
                move_left
            ]
            _then ( action = right )
            [
                move_right
            ]
            _then ( action = stop2 )
            [
                move_stop
            ]
            _then ( action = beep_key )
            [
                beep
            ]
            set index index + 1
            wait playback_wait
            show " "
        ]
        set index (4) 
    ]
    set index (4) 
    show "finished"
end

to move_stop
    output1234,
    off
    record_command stop2
end

to move_forward
    output1,
    cw
    output4,
    ccw
    output14,
    onfor move_wait
    record_command forward2
end

to move_backward
    output1,
    ccw
    output4,
    cw
    output14,
    onfor move_wait
    record_command backward
end

to move_left
    output14,
    ccw
    onfor turn_wait
    record_command left
end

to move_right
    output14,
    cw
    onfor turn_wait
    record_command right
end

to record_command :command
  if is_record
  [
    show command
    set commands (( commands + command ))
  ]
end`
}
