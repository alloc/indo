# Using Yarn Workspaces

Non-vendor packages can be linked to packages within a local Yarn workspace. 

You have 2 options:

1. Clone the workspace when other developers run `indo` next.

2. Treat the workspace as a local override.

&nbsp;

## Option 1 - Force others to use it

1. Clone the workspace (with `indo`):

```sh
indo clone https://github.com/example/example.git ./vendor/example --branch next
```

2. Prepare the workspace:

```sh
cd ./vendor/example && yarn
```

3. Expose packages in the workspace to your non-vendor packages:

```sh
indo
```

4. Done!

&nbsp;

## Option 2 - Keep it to myself

1. Clone the workspace (with `git`):

```sh
git clone https://github.com/example/example.git ./vendor/example --branch next
```

2. Prepare the workspace

```sh
cd ./vendor/example && yarn
```

3. Expose packages in the workspace to your non-vendor packages:

```sh
indo
```

4. Make sure the workspace is ignored by git

```sh
echo '/vendor/' >> .gitignore
```

5. Done!
