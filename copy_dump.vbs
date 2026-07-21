Set fso = CreateObject("Scripting.FileSystemObject")
src = "C:\Users\New\Documents\GitHub\Han_OPS\repo_dump.txt"
dst = "C:\Users\New\AppData\Roaming\Claude\local-agent-mode-sessions\42b2f7ec-e8ea-40ef-878d-0cb3673825e1\db61efaf-2591-4995-ac19-d844228bc868\local_7cacd3fa-dc6b-4063-b3e9-a00de282e520\outputs\repo_dump.txt"
fso.CopyFile src, dst, True
MsgBox "Copied to outputs!"
